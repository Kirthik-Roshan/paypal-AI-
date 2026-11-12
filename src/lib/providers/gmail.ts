import { z } from "zod";
import { DomainError } from "../db";

export async function gmailSender(transport: typeof fetch) {
  const missing = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GMAIL_SENDER_EMAIL",
  ].filter((k) => !process.env[k]);
  if (missing.length)
    throw new DomainError(`Gmail setup required: ${missing.join(", ")}.`, 503);
  const sender = z.email().parse(process.env.GMAIL_SENDER_EMAIL);
  const auth = await transport("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!auth.ok)
    throw new DomainError(
      `Google authorization failed (${auth.status}). Reconnect the sender with gmail.send permission. No email was sent.`,
      503,
    );
  const token = z
    .object({ access_token: z.string().min(1) })
    .parse(await auth.json());
  return (recipient: string, subject: string, text: string) => {
    const message = [
      `From: ${sender}`,
      `To: ${z.email().parse(recipient)}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(text).toString("base64"),
    ].join("\r\n");
    return transport(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: Buffer.from(message).toString("base64url"),
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
  };
}
