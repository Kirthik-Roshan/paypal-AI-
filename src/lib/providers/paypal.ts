import { z } from "zod";
import {
  all,
  audit,
  db,
  DomainError,
  id,
  insert,
  now,
  one,
  requireRecord,
  run,
} from "../db";
import { getAgreement, getRequest, paymentEligibility } from "../domain";
import { decimal, minor } from "../money";
import type { Agreement, Payment, Supplier, Workspace } from "../types";

const base = "https://api-m.sandbox.paypal.com";
type PaypalResponse = Record<string, any>;
export type PaypalTransport = (
  path: string,
  method?: string,
  body?: unknown,
  requestId?: string,
) => Promise<PaypalResponse>;
export class ProviderError extends DomainError {
  constructor(
    message: string,
    public uncertain: boolean,
  ) {
    super(message, 502);
  }
}
let tokenCache: { value: string; expires: number } | undefined;
function credentials() {
  const keys = [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_MERCHANT_ID",
    "PAYPAL_WEBHOOK_ID",
  ];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length)
    throw new DomainError(
      `Connect PayPal sandbox in Settings. Missing: ${missing.join(", ")}.`,
      503,
    );
}
async function accessToken() {
  credentials();
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.value;
  let response: Response;
  try {
    response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ProviderError(
      "Could not connect to PayPal. Check network access and try preflight again.",
      false,
    );
  }
  if (!response.ok)
    throw new ProviderError(
      `PayPal sign-in failed (${response.status}). Check sandbox credentials.`,
      false,
    );
  const result = z
    .object({ access_token: z.string(), expires_in: z.number() })
    .parse(await response.json());
  tokenCache = {
    value: result.access_token,
    expires: Date.now() + Math.max(0, result.expires_in - 60) * 1000,
  };
  return result.access_token;
}
export const paypalFetch: PaypalTransport = async (
  path,
  method = "GET",
  body,
  requestId,
) => {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ProviderError(
      "PayPal did not confirm the result. Reconcile provider state before attempting another operation.",
      method !== "GET",
    );
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const issue = result.details?.[0]?.issue || result.name || "PROVIDER_ERROR";
    throw new ProviderError(
      `PayPal returned ${response.status}: ${issue}. No success has been recorded.`,
      response.status >= 500,
    );
  }
  if (response.status === 204) return {};
  try {
    return await response.json();
  } catch {
    throw new ProviderError(
      "PayPal response was unreadable. Reconcile before retrying.",
      method !== "GET",
    );
  }
};
export async function paypalPreflight() {
  let status = "Setup required",
    detail = "";
  try {
    await accessToken();
    status = "OAuth verified";
    detail =
      "Sandbox OAuth succeeded. Merchant ownership, buyer approval, webhooks and payment capabilities still need an end-to-end account test.";
  } catch (e) {
    detail = e instanceof Error ? e.message : "PayPal preflight failed.";
  }
  run(
    "INSERT INTO preflight (provider,status,detail,checked_at) VALUES (?,?,?,?) ON CONFLICT(provider) DO UPDATE SET status=excluded.status,detail=excluded.detail,checked_at=excluded.checked_at",
    "paypal",
    status,
    detail,
    now(),
  );
  return { status, detail };
}
export type Operation = {
  id: string;
  workspace_id: string;
  payment_id: string;
  kind: string;
  operation_key: string;
  request_id: string;
  status: string;
  amount: number | null;
  reason: string | null;
  provider_ref: string | null;
  response: string | null;
  created_at: string;
  updated_at: string;
};
function financialContext(workspace: Workspace, requestId: string) {
  if (workspace.mode !== "sandbox")
    throw new DomainError(
      workspace.mode === "sample"
        ? "Sample walkthrough never creates real or simulated payments. Open connected sandbox in Settings."
        : "Connect owner sign-in and PayPal sandbox in Settings before creating a payment.",
      403,
    );
  const request = getRequest(workspace.id, requestId);
  const agreement = requireRecord(getAgreement(workspace.id, requestId));
  const supplier = requireRecord(
    one<Supplier>(
      "SELECT * FROM suppliers WHERE id=? AND workspace_id=?",
      agreement.supplier_id,
      workspace.id,
    ),
  );
  const payment = requireRecord(
    one<Payment>(
      "SELECT * FROM payments WHERE workspace_id=? AND agreement_id=?",
      workspace.id,
      agreement.id,
    ),
  );
  if (
    !agreement.buyer_accepted ||
    !agreement.supplier_accepted ||
    agreement.requirement_version !== request.version
  )
    throw new DomainError("Both parties must accept the current agreement.");
  if (
    payment.amount !== agreement.amount ||
    payment.currency !== agreement.currency
  )
    throw new DomainError("Payment does not match the frozen agreement.", 409);
  if (
    !supplier.merchant_id ||
    supplier.merchant_id !== process.env.PAYPAL_MERCHANT_ID
  )
    throw new DomainError(
      "Map this supplier to the dedicated sandbox test merchant in Settings. Arbitrary supplier payments are not supported.",
      503,
    );
  return { request, agreement, supplier, payment };
}
function assertAmount(data: PaypalResponse, a: Agreement) {
  if (
    data.amount?.currency_code !== a.currency ||
    minor(data.amount?.value || "0") !== a.amount
  )
    throw new DomainError(
      "Provider amount or currency does not match the agreement. Payment remains blocked.",
      409,
    );
}
function reserve(
  workspace: string,
  paymentId: string,
  kind: string,
  key: string,
  amount?: number,
  reason?: string,
) {
  return db().transaction(() => {
    const existing = one<Operation>(
      "SELECT * FROM payment_operations WHERE operation_key=?",
      key,
    );
    if (existing?.status === "completed") return { op: existing, done: true };
    if (existing && ["running", "uncertain"].includes(existing.status))
      throw new DomainError(
        "This operation is still unresolved. Reconcile PayPal state before retrying.",
        409,
      );
    if (
      one(
        "SELECT id FROM payment_operations WHERE payment_id=? AND status IN (?,?)",
        paymentId,
        "running",
        "uncertain",
      )
    )
      throw new DomainError(
        "Another payment operation needs reconciliation first.",
        409,
      );
    if (existing) {
      run(
        "UPDATE payment_operations SET status=?,updated_at=? WHERE id=?",
        "running",
        now(),
        existing.id,
      );
      return { op: existing, done: false };
    }
    const op: Operation = {
      id: id(),
      workspace_id: workspace,
      payment_id: paymentId,
      kind,
      operation_key: key,
      request_id: id(),
      status: "running",
      amount: amount ?? null,
      reason: reason ?? null,
      provider_ref: null,
      response: null,
      created_at: now(),
      updated_at: now(),
    };
    insert("payment_operations", op);
    return { op, done: false };
  })();
}
function finish(
  op: Operation,
  ref: string | undefined,
  result: PaypalResponse,
) {
  run(
    "UPDATE payment_operations SET status=?,provider_ref=?,response=?,updated_at=? WHERE id=?",
    "completed",
    ref || null,
    JSON.stringify({ status: result.status, id: result.id }),
    now(),
    op.id,
  );
}
function fail(
  op: Operation,
  error: unknown,
  providerMutationSucceeded: boolean,
) {
  const uncertain =
    providerMutationSucceeded ||
    (error instanceof ProviderError
      ? error.uncertain
      : !(error instanceof DomainError));
  run(
    "UPDATE payment_operations SET status=?,response=?,updated_at=? WHERE id=?",
    uncertain ? "uncertain" : "failed",
    JSON.stringify({
      error: error instanceof Error ? error.message : "Provider result unknown",
    }),
    now(),
    op.id,
  );
}
export async function paymentAction(
  workspace: Workspace,
  requestId: string,
  action: string,
  input: Record<string, unknown> = {},
  transport: PaypalTransport = paypalFetch,
) {
  const { request, agreement, supplier, payment } = financialContext(
    workspace,
    requestId,
  );
  if (
    !["create", "authorize", "capture", "void", "refund", "reconcile"].includes(
      action,
    )
  )
    throw new DomainError("Unknown payment action.");
  if (action === "reconcile")
    return reconcilePayment(workspace, requestId, transport);
  if (action === "create" && payment.order_id)
    return { approvalUrl: payment.approval_url };
  if (action === "authorize" && payment.authorization_id)
    return { status: payment.status };
  if (action === "capture" && payment.capture_id)
    return { status: payment.status };
  if (action === "void" && payment.status === "Voided")
    return { status: payment.status };
  let refundAmount: number | undefined, reason: string | undefined;
  if (action === "create" && payment.status !== "Not started")
    throw new DomainError("This stage already has a payment operation.");
  if (["authorize", "capture", "void"].includes(action) && !payment.order_id)
    throw new DomainError("Create a buyer-approved PayPal order first.");
  if (["capture", "void"].includes(action) && !payment.authorization_id)
    throw new DomainError("Funds have not been authorized.");
  if (action === "capture") {
    const e = paymentEligibility(workspace.id, requestId);
    if (!e.eligible) throw new DomainError(e.reasons.join("; "));
    if (payment.status !== "Authorized")
      throw new DomainError("A valid authorization is required.");
    if (
      !payment.authorized_at ||
      Date.now() - new Date(payment.authorized_at).getTime() > 3 * 86400000
    )
      throw new DomainError(
        "The initial three-day honor period has passed. Void the unused authorization and obtain renewed buyer approval in a replacement request.",
      );
  }
  if (
    action === "void" &&
    (payment.capture_id || payment.status !== "Authorized")
  )
    throw new DomainError("Only an unused authorization can be voided.");
  let key = `${payment.id}:${action}`;
  if (action === "refund") {
    if (!payment.capture_id)
      throw new DomainError("There is no captured payment to refund.");
    const value = z
      .object({
        amount: z.string(),
        reason: z.string().min(3).max(250),
        operationKey: z.uuid(),
      })
      .parse(input);
    refundAmount = minor(value.amount);
    reason = value.reason;
    key = `${payment.id}:refund:${value.operationKey}`;
    const previous = one<Operation>(
      "SELECT * FROM payment_operations WHERE operation_key=?",
      key,
    );
    if (
      previous &&
      (previous.amount !== refundAmount || previous.reason !== reason)
    )
      throw new DomainError(
        "This refund request ID is already bound to another amount or reason.",
        409,
      );
    if (previous && ["completed", "pending"].includes(previous.status))
      return {
        status:
          previous.status === "pending" ? "Refund pending" : payment.status,
        reference: previous.provider_ref,
      };
    const pending = one<{ n: number }>(
      "SELECT COALESCE(SUM(amount),0) as n FROM payment_operations WHERE payment_id=? AND kind=? AND status IN (?,?,?)",
      payment.id,
      "refund",
      "running",
      "uncertain",
      "pending",
    )!.n;
    if (
      refundAmount <= 0 ||
      refundAmount > payment.amount - payment.refunded - pending
    )
      throw new DomainError(
        "The refund exceeds the remaining refundable balance.",
      );
  }
  const { op, done } = reserve(
    workspace.id,
    payment.id,
    action,
    key,
    refundAmount,
    reason,
  );
  if (done) return { status: payment.status, reference: op.provider_ref };
  let mutated = false;
  try {
    if (action === "create") {
      const app = new URL(process.env.APP_URL || "http://localhost:3000");
      const result = await transport(
        "/v2/checkout/orders",
        "POST",
        {
          intent: "AUTHORIZE",
          purchase_units: [
            {
              reference_id: agreement.id,
              custom_id: `${workspace.id}:${agreement.id}`,
              invoice_id: `PP-${payment.id}`,
              description: `${request.title} · ${agreement.stage}`,
              payee: { merchant_id: supplier.merchant_id },
              amount: {
                currency_code: agreement.currency,
                value: decimal(agreement.amount),
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: workspace.name,
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: `${app.origin}/requests/${request.id}?tab=payments&paypal=return`,
                cancel_url: `${app.origin}/requests/${request.id}?tab=payments&paypal=cancel`,
              },
            },
          },
        },
        op.request_id,
      );
      mutated = true;
      const resultId = z.string().min(1).parse(result.id);
      const link = result.links?.find((l: any) =>
        ["payer-action", "approve"].includes(l.rel),
      )?.href;
      if (
        !link ||
        !["www.sandbox.paypal.com", "sandbox.paypal.com"].includes(
          new URL(link).hostname,
        )
      )
        throw new DomainError(
          "PayPal did not return a valid sandbox approval link.",
          502,
        );
      db().transaction(() => {
        run(
          "UPDATE payments SET order_id=?,approval_url=?,status=?,updated_at=? WHERE id=?",
          resultId,
          link,
          "Awaiting buyer approval",
          now(),
          payment.id,
        );
        finish(op, resultId, result);
        audit(
          workspace.id,
          requestId,
          "payment",
          "PayPal sandbox order created. Buyer approval and authorization are still required.",
        );
      })();
      return { approvalUrl: link };
    }
    if (action === "authorize") {
      const order = await transport(`/v2/checkout/orders/${payment.order_id}`);
      if (order.status !== "APPROVED")
        throw new DomainError(
          "PayPal has not confirmed buyer approval. A redirect is not payment proof.",
        );
      const unit = order.purchase_units?.find(
        (u: any) => u.reference_id === agreement.id,
      );
      if (!unit || unit.payee?.merchant_id !== supplier.merchant_id)
        throw new DomainError(
          "PayPal order recipient does not match this agreement.",
        );
      assertAmount(unit, agreement);
      const result = await transport(
        `/v2/checkout/orders/${payment.order_id}/authorize`,
        "POST",
        {},
        op.request_id,
      );
      mutated = true;
      const auth = result.purchase_units?.[0]?.payments?.authorizations?.[0];
      if (!auth?.id || auth.status !== "CREATED")
        throw new DomainError(
          "PayPal has not confirmed an active authorization.",
          502,
        );
      assertAmount(auth, agreement);
      db().transaction(() => {
        run(
          "UPDATE payments SET authorization_id=?,status=?,authorized_at=?,expires_at=?,updated_at=? WHERE id=?",
          auth.id,
          "Authorized",
          auth.create_time || now(),
          auth.expiration_time ||
            new Date(Date.now() + 29 * 86400000).toISOString(),
          now(),
          payment.id,
        );
        finish(op, auth.id, auth);
        audit(
          workspace.id,
          requestId,
          "payment",
          "Funds authorized by PayPal. Nothing has been captured or received by the supplier.",
        );
      })();
      return { status: "Authorized" };
    }
    if (action === "capture" || action === "void") {
      const auth = await transport(
        `/v2/payments/authorizations/${payment.authorization_id}`,
      );
      assertAmount(auth, agreement);
      if (auth.status !== "CREATED")
        throw new DomainError(
          `PayPal authorization is ${auth.status}. Reconcile the payment before continuing.`,
          409,
        );
      if (
        auth.expiration_time &&
        new Date(auth.expiration_time).getTime() <= Date.now()
      )
        throw new DomainError(
          "Authorization has expired. Obtain new buyer approval.",
        );
      // Recheck fresh DB state after provider read; all conflicting mutations also
      // reject while an operation is running, so acceptance cannot race a capture.
      if (action === "capture") {
        const e = paymentEligibility(workspace.id, requestId);
        if (!e.eligible) throw new DomainError(e.reasons.join("; "));
      }
      const result = await transport(
        `/v2/payments/authorizations/${payment.authorization_id}/${action}`,
        "POST",
        action === "capture"
          ? {
              amount: {
                currency_code: agreement.currency,
                value: decimal(agreement.amount),
              },
              final_capture: true,
            }
          : undefined,
        op.request_id,
      );
      mutated = true;
      if (action === "capture") {
        if (!result.id || !["COMPLETED", "PENDING"].includes(result.status))
          throw new DomainError("PayPal has not confirmed capture.", 502);
        assertAmount(result, agreement);
      }
      const state =
        action === "void"
          ? "Voided"
          : result.status === "COMPLETED"
            ? "Captured"
            : "Capture pending";
      db().transaction(() => {
        run(
          "UPDATE payments SET capture_id=COALESCE(?,capture_id),status=?,updated_at=? WHERE id=?",
          action === "capture" ? result.id : null,
          state,
          now(),
          payment.id,
        );
        finish(op, result.id || payment.authorization_id!, result);
        audit(
          workspace.id,
          requestId,
          "payment",
          `PayPal verified state: ${state}.`,
        );
        if (state === "Captured")
          run("UPDATE requests SET status=? WHERE id=?", "Paid", requestId);
      })();
      return { status: state };
    }
    if (action === "refund") {
      const capture = await transport(
        `/v2/payments/captures/${payment.capture_id}`,
      );
      assertAmount(capture, agreement);
      if (!["COMPLETED", "PARTIALLY_REFUNDED"].includes(capture.status))
        throw new DomainError(
          `This capture is ${capture.status} and cannot be refunded here.`,
        );
      const result = await transport(
        `/v2/payments/captures/${payment.capture_id}/refund`,
        "POST",
        {
          amount: {
            currency_code: agreement.currency,
            value: decimal(refundAmount!),
          },
          note_to_payer: reason,
        },
        op.request_id,
      );
      mutated = true;
      if (
        !result.id ||
        !["COMPLETED", "PENDING"].includes(result.status) ||
        result.amount?.currency_code !== agreement.currency ||
        minor(result.amount?.value || "0") !== refundAmount
      )
        throw new DomainError(
          "Refund response does not match the approved amount.",
          502,
        );
      db().transaction(() => {
        finish(op, result.id, result);
        if (result.status === "PENDING") {
          run(
            "UPDATE payment_operations SET status=? WHERE id=?",
            "pending",
            op.id,
          );
          run(
            "UPDATE payments SET status=?,updated_at=? WHERE id=?",
            "Refund pending",
            now(),
            payment.id,
          );
        } else {
          const total = payment.refunded + refundAmount!;
          run(
            "UPDATE payments SET refunded=?,status=?,updated_at=? WHERE id=?",
            total,
            total === payment.amount ? "Refunded" : "Partially refunded",
            now(),
            payment.id,
          );
        }
        audit(
          workspace.id,
          requestId,
          "refund",
          `PayPal refund ${result.status.toLowerCase()}: ${decimal(refundAmount!)} ${agreement.currency}. Reason: ${reason}`,
        );
      })();
      return {
        status: result.status === "PENDING" ? "Refund pending" : "Refunded",
      };
    }
  } catch (e) {
    fail(op, e, mutated);
    throw e;
  }
}
export async function reconcilePayment(
  workspace: Workspace,
  requestId: string,
  transport: PaypalTransport = paypalFetch,
) {
  const { payment, agreement, supplier } = financialContext(
    workspace,
    requestId,
  );
  if (!payment.order_id)
    throw new DomainError(
      "No provider order reference is available. If order creation timed out, resolve the saved request ID with PayPal support before retrying.",
    );
  const order = await transport(`/v2/checkout/orders/${payment.order_id}`);
  const unit = order.purchase_units?.find(
    (u: any) => u.reference_id === agreement.id,
  );
  if (
    !unit ||
    unit.payee?.merchant_id !== supplier.merchant_id ||
    unit.custom_id !== `${workspace.id}:${agreement.id}`
  )
    throw new DomainError("Provider order ownership did not match.", 409);
  assertAmount(unit, agreement);
  const authRef =
    unit.payments?.authorizations?.[0]?.id || payment.authorization_id;
  const captureRef = unit.payments?.captures?.[0]?.id || payment.capture_id;
  const auth = authRef
    ? await transport(`/v2/payments/authorizations/${authRef}`)
    : null;
  const capture = captureRef
    ? await transport(`/v2/payments/captures/${captureRef}`)
    : null;
  if (auth) assertAmount(auth, agreement);
  if (capture) assertAmount(capture, agreement);
  let status = payment.status;
  if (capture)
    status =
      capture.status === "COMPLETED"
        ? "Captured"
        : capture.status === "PENDING"
          ? "Capture pending"
          : capture.status === "REFUNDED"
            ? "Refunded"
            : capture.status === "PARTIALLY_REFUNDED"
              ? "Partially refunded"
              : capture.status === "DECLINED"
                ? "Failed"
                : payment.status;
  else if (auth?.status === "VOIDED") status = "Voided";
  else if (auth?.status === "CREATED") status = "Authorized";
  else if (auth?.status === "EXPIRED") status = "Expired";
  db().transaction(() => {
    const current = requireRecord(
      one<Payment>("SELECT * FROM payments WHERE id=?", payment.id),
    );
    if (
      current.updated_at !== payment.updated_at ||
      current.status !== payment.status ||
      current.capture_id !== payment.capture_id ||
      current.refunded !== payment.refunded
    )
      throw new DomainError(
        "Payment changed during reconciliation. Refresh provider state again.",
        409,
      );
    // Refund totals are reconstructed from each real refund ID, including pending
    // operations; event ordering never decrements a completed refund.
    run(
      "UPDATE payments SET authorization_id=COALESCE(?,authorization_id),capture_id=COALESCE(?,capture_id),status=?,authorized_at=COALESCE(authorized_at,?),expires_at=COALESCE(?,expires_at),updated_at=? WHERE id=?",
      authRef || null,
      captureRef || null,
      status,
      auth?.create_time || null,
      auth?.expiration_time || null,
      now(),
      payment.id,
    );
    if (authRef)
      run(
        "UPDATE payment_operations SET status='completed',provider_ref=?,updated_at=? WHERE payment_id=? AND kind='authorize' AND status IN ('uncertain','running')",
        authRef,
        now(),
        payment.id,
      );
    if (captureRef)
      run(
        "UPDATE payment_operations SET status='completed',provider_ref=?,updated_at=? WHERE payment_id=? AND kind='capture' AND status IN ('uncertain','running')",
        captureRef,
        now(),
        payment.id,
      );
    if (status === "Voided")
      run(
        "UPDATE payment_operations SET status='completed',updated_at=? WHERE payment_id=? AND kind='void' AND status IN ('uncertain','running')",
        now(),
        payment.id,
      );
  })();
  const refunds = all<Operation>(
    "SELECT * FROM payment_operations WHERE payment_id=? AND kind='refund' AND provider_ref IS NOT NULL",
    payment.id,
  );
  for (const refund of refunds) {
    const result = await transport(
      `/v2/payments/refunds/${refund.provider_ref}`,
    );
    if (
      result.amount?.currency_code !== payment.currency ||
      minor(result.amount?.value || "0") !== refund.amount
    )
      throw new DomainError("Refund reconciliation amount mismatch.");
    if (result.status === "COMPLETED")
      run(
        "UPDATE payment_operations SET status=?,updated_at=? WHERE id=?",
        "completed",
        now(),
        refund.id,
      );
    else if (["FAILED", "CANCELLED"].includes(result.status))
      run(
        "UPDATE payment_operations SET status=?,updated_at=? WHERE id=?",
        "failed",
        now(),
        refund.id,
      );
  }
  const sums = one<{ n: number }>(
    "SELECT COALESCE(SUM(amount),0) as n FROM payment_operations WHERE payment_id=? AND kind='refund' AND status='completed'",
    payment.id,
  )!.n;
  if (sums > payment.amount)
    throw new DomainError(
      "Provider refund reconciliation exceeds agreement. Review manually.",
    );
  const pending = one(
    "SELECT id FROM payment_operations WHERE payment_id=? AND kind='refund' AND status IN ('pending','uncertain','running')",
    payment.id,
  );
  run(
    "UPDATE payments SET refunded=?,status=?,updated_at=? WHERE id=?",
    sums,
    pending
      ? "Refund pending"
      : sums === payment.amount
        ? "Refunded"
        : sums > 0
          ? "Partially refunded"
          : status,
    now(),
    payment.id,
  );
  audit(
    workspace.id,
    requestId,
    "payment",
    "Retrieved current payment state directly from PayPal. Redirects and callback order were not used as proof.",
  );
  return {
    status: one<Payment>("SELECT * FROM payments WHERE id=?", payment.id)!
      .status,
  };
}
export async function verifyPaypalWebhook(
  headers: Headers,
  event: unknown,
  transport: PaypalTransport = paypalFetch,
) {
  if (!process.env.PAYPAL_WEBHOOK_ID)
    throw new DomainError("PayPal webhook setup is incomplete.", 503);
  const names = [
    "auth-algo",
    "cert-url",
    "transmission-id",
    "transmission-sig",
    "transmission-time",
  ];
  if (names.some((n) => !headers.get(`paypal-${n}`)))
    throw new DomainError("Missing PayPal webhook verification headers.", 401);
  const result = await transport(
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
  );
  if (result.verification_status !== "SUCCESS")
    throw new DomainError("PayPal could not authenticate this event.", 401);
}
export async function processPaypalWebhook(
  event: PaypalResponse,
  transport: PaypalTransport = paypalFetch,
  defer = false,
) {
  const schema = z.object({
    id: z.string(),
    event_type: z.string(),
    resource: z.record(z.string(), z.any()),
  });
  const e = schema.parse(event);
  const related = e.resource.supplementary_data?.related_ids || {};
  const p = one<Payment>(
    "SELECT p.* FROM payments p LEFT JOIN payment_operations o ON o.payment_id=p.id WHERE p.order_id=? OR p.authorization_id=? OR p.capture_id=? OR o.provider_ref=? LIMIT 1",
    related.order_id || e.resource.id || "",
    related.authorization_id || e.resource.id || "",
    related.capture_id || e.resource.id || "",
    e.resource.id || "",
  );
  const inserted = db().transaction(() => {
    const result = run(
      "INSERT OR IGNORE INTO provider_events (id,provider,external_id,workspace_id,payload,received_at) VALUES (?,?,?,?,?,?)",
      id(),
      "paypal",
      e.id,
      p?.workspace_id || null,
      JSON.stringify({ type: e.event_type, resourceId: e.resource.id }),
      now(),
    );
    if (result.changes && p && defer)
      insert("jobs", {
        id: id(),
        workspace_id: p.workspace_id,
        request_id: p.request_id,
        kind: "payment-reconcile",
        payload: JSON.stringify({ providerEventId: e.id }),
        status: "queued",
        attempts: 0,
        run_after: now(),
        locked_at: null,
        error: null,
        created_at: now(),
      });
    return result.changes;
  })();
  if (!inserted) return { duplicate: true };
  if (defer) return { received: true };
  if (p) {
    const w = requireRecord(
      one<Workspace>("SELECT * FROM workspaces WHERE id=?", p.workspace_id),
    );
    try {
      await reconcilePayment(w, p.request_id, transport);
    } catch (e) {
      run(
        "DELETE FROM provider_events WHERE provider=? AND external_id=?",
        "paypal",
        event.id,
      );
      throw e;
    }
  }
  return { received: true };
}
