import { z } from "zod";
import { audit, DomainError, now, one, run } from "../db";
import { getRequest, invitationByToken } from "../domain";
import type { Workspace } from "../types";
import { gmailSender } from "./gmail";

export function publicAppOrigin() {
  try {
    const url = new URL(process.env.APP_URL || "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname.includes(".") ||
      /(^localhost$|\.localhost$|\.local$|^[\d.]+$|:)/i.test(url.hostname)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function emailInvitation(
  w: Workspace,
  requestId: string,
  token: string,
  transport: typeof fetch = fetch,
) {
  getRequest(w.id, requestId);
  const { inv, request, supplier } = invitationByToken(token);
  if (inv.workspace_id !== w.id || inv.request_id !== requestId)
    throw new DomainError(
      "This invitation is not available in your workspace.",
      404,
    );
  if (w.mode !== "sandbox")
    throw new DomainError(
      "Sign into the connected owner workspace before emailing suppliers.",
      503,
    );
  if (supplier.do_not_contact)
    throw new DomainError("This supplier has declined further contact.");
  const recipient = z.email().safeParse(supplier.email);
  if (!recipient.success)
    throw new DomainError("Add a valid email address to this supplier first.");
  const origin = publicAppOrigin();
  if (!origin)
    throw new DomainError(
      "Deploy the app and set APP_URL to its public HTTPS origin before emailing invitations.",
      503,
    );
  const useGmail = process.env.EMAIL_PROVIDER === "gmail";
  if (!useGmail && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM))
    throw new DomainError(
      "Email setup required: set RESEND_API_KEY and EMAIL_FROM to a verified sender.",
      503,
    );
  const previous = one<{ status: string; provider_id: string | null }>(
    "SELECT * FROM invitation_emails WHERE invitation_id=?",
    inv.id,
  );
  if (previous?.status === "accepted")
    return { accepted: true, providerId: previous.provider_id };
  if (previous)
    throw new DomainError(
      "An email attempt already exists. Check the email provider before sending another invitation.",
      409,
    );
  // Authorize before claiming a send attempt: token failure cannot deliver mail.
  const sendGmail = useGmail ? await gmailSender(transport) : null;
  // Unique invitation ID prevents concurrent clicks and retries after uncertain delivery.
  const claimed = run(
    "INSERT OR IGNORE INTO invitation_emails (invitation_id,status,created_at,updated_at) VALUES (?,'sending',?,?)",
    inv.id,
    now(),
    now(),
  );
  if (!claimed.changes)
    throw new DomainError("This invitation already has an email attempt.", 409);
  try {
    const subject = `Quotation requested: ${request.title}`;
    const text = `Hello ${supplier.contact || supplier.company},\n\n${w.name} invites you to provide a written quotation for ${request.title}.\n\nOpen your private supplier portal:\n${origin}/quote/${token}\n\nThis link expires on ${inv.expires_at}. Keep it private. You can view the confirmed requirements, submit your quotation and respond to an agreement through this link. No buyer account is required.\n\nThis enquiry is not a confirmed order.\n\n${w.name} via ProcureProof`;
    const response = sendGmail
      ? await sendGmail(recipient.data, subject, text)
      : await transport("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `quote-invitation/${inv.id}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [recipient.data],
            subject,
            text,
          }),
          signal: AbortSignal.timeout(20000),
        });
    if (!response.ok) {
      run(
        "UPDATE invitation_emails SET status=?,updated_at=? WHERE invitation_id=?",
        response.status >= 500 ? "uncertain" : "rejected",
        now(),
        inv.id,
      );
      throw new DomainError(
        `Email provider returned ${response.status}. Delivery is not confirmed. Check your sender verification and provider dashboard.`,
        502,
      );
    }
    const result = z
      .object({ id: z.string().min(1) })
      .parse(await response.json());
    run(
      "UPDATE invitation_emails SET status='accepted',provider_id=?,updated_at=? WHERE invitation_id=?",
      result.id,
      now(),
      inv.id,
    );
    audit(
      w.id,
      requestId,
      "invitation",
      `Email provider accepted the quotation invitation for ${supplier.company}. Inbox delivery is not yet verified.`,
    );
    return { accepted: true, providerId: result.id };
  } catch (e) {
    run(
      "UPDATE invitation_emails SET status='uncertain',updated_at=? WHERE invitation_id=? AND status='sending'",
      now(),
      inv.id,
    );
    if (e instanceof DomainError) throw e;
    throw new DomainError(
      "Email delivery result is uncertain. Check the provider dashboard before sending another invitation.",
      502,
    );
  }
}
