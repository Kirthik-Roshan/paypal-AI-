import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  all,
  audit,
  db,
  DomainError,
  events,
  id,
  insert,
  now,
  one,
  requireRecord,
  run,
} from "./db";
import { currencies, minor } from "./money";
import type {
  Agreement,
  Asset,
  DashboardData,
  Invitation,
  Payment,
  PurchaseRequest,
  Quote,
  Review,
  Submission,
  Supplier,
  Workspace,
} from "./types";

export const specSchema = z
  .object({
    description: z.string().max(5000),
    quantity: z.number().int().positive().max(1000000),
    unit: z.string().min(1).max(40),
    dimensions: z.string().max(200),
    material: z.string().max(200),
    colour: z.string().max(200),
    exactText: z.string().max(1000),
    requiredElement: z.string().max(500),
    visualNotes: z.string().max(2000),
    deadline: z.iso.date(),
    currency: z.enum(currencies),
    budget: z.number().int().positive().max(100000000),
    destination: z.string().max(500),
    taxIncluded: z.boolean(),
    shippingIncluded: z.boolean(),
    alternatives: z.string().max(1000),
    supplierIds: z.array(z.string()).max(30),
    discover: z.boolean(),
    region: z.string().max(200),
    maxContacts: z.number().int().min(0).max(10),
    language: z.string().max(50),
    channel: z.enum(["Email", "Phone"]),
    outreachStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    outreachEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().max(100),
    negotiable: z.string().max(1000),
    askOwner: z.string().max(1000),
  })
  .strict();
export function getRequest(workspace: string, requestId: string) {
  const row = requireRecord(
    one<PurchaseRequest & { spec: string }>(
      "SELECT * FROM requests WHERE id=? AND workspace_id=?",
      requestId,
      workspace,
    ),
  );
  return { ...row, spec: JSON.parse(row.spec) } as PurchaseRequest;
}
export function getAgreement(workspace: string, requestId: string) {
  return one<Agreement>(
    "SELECT * FROM agreements WHERE workspace_id=? AND request_id=?",
    workspace,
    requestId,
  );
}
export function assertNoActivePayment(workspace: string, requestId: string) {
  if (
    one(
      "SELECT o.id FROM payment_operations o JOIN payments p ON p.id=o.payment_id WHERE p.workspace_id=? AND p.request_id=? AND o.status IN ('running','uncertain')",
      workspace,
      requestId,
    )
  )
    throw new DomainError(
      "A payment operation is unresolved. Reconcile it before changing this stage.",
      409,
    );
}
export function getData(workspace: Workspace): DashboardData {
  const scoped = <T>(table: string, order = "created_at DESC") =>
    all<T>(
      `SELECT * FROM ${table} WHERE workspace_id=? ORDER BY ${order}`,
      workspace.id,
    );
  return {
    workspace,
    requests: scoped<PurchaseRequest & { spec: string }>("requests").map(
      (r) => ({ ...r, spec: JSON.parse(r.spec) }),
    ),
    suppliers: scoped<Supplier>("suppliers"),
    quotes: all<Quote>(
      "SELECT q.*,s.company,s.relationship FROM quotes q JOIN suppliers s ON s.id=q.supplier_id WHERE q.workspace_id=? ORDER BY q.created_at DESC,q.rowid DESC",
      workspace.id,
    ),
    agreements: scoped<Agreement>("agreements"),
    assets: all<Asset>(
      "SELECT id,workspace_id,request_id,name,mime,role,size,sha256,CASE WHEN preview IS NOT NULL THEN id ELSE NULL END as preview,created_at FROM assets WHERE workspace_id=? ORDER BY created_at DESC,rowid DESC",
      workspace.id,
    ),
    submissions: scoped<Submission>(
      "submissions",
      "created_at DESC,rowid DESC",
    ),
    reviews: scoped<Review & { findings: string }>(
      "reviews",
      "created_at DESC,rowid DESC",
    ).map((r) => ({ ...r, findings: JSON.parse(r.findings) })),
    payments: scoped<Payment>("payments", "updated_at DESC"),
    activity: events(workspace.id),
    calls: scoped("calls"),
    candidates: scoped("candidates", "retrieved_at DESC"),
    jobs: scoped("jobs"),
  };
}
export function saveRequest(workspace: Workspace, input: unknown) {
  const value = z
    .object({
      id: z.string().optional(),
      title: z.string().min(3).max(150),
      category: z.string().min(1).max(100),
      spec: specSchema,
      confirm: z.boolean().default(false),
    })
    .parse(input);
  value.spec.supplierIds.forEach((sid) =>
    requireRecord(
      one(
        "SELECT id FROM suppliers WHERE id=? AND workspace_id=?",
        sid,
        workspace.id,
      ),
    ),
  );
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.spec.timezone });
  } catch {
    throw new DomainError("Choose a valid outreach time zone.");
  }
  if (
    value.confirm &&
    (!value.spec.description.trim() ||
      !value.spec.destination.trim() ||
      value.spec.deadline < new Date().toISOString().slice(0, 10))
  )
    throw new DomainError(
      "Add a description, delivery destination, and a future deadline before confirming.",
    );
  return db().transaction(() => {
    const existing = value.id ? getRequest(workspace.id, value.id) : null;
    if (existing) assertNoActivePayment(workspace.id, existing.id);
    if (existing?.version && !value.confirm)
      throw new DomainError(
        "Confirmed requirements are frozen. Confirm a new version to make changes.",
      );
    if (
      existing &&
      one<Payment>(
        "SELECT * FROM payments WHERE request_id=? AND order_id IS NOT NULL",
        existing.id,
      )
    )
      throw new DomainError(
        "This agreement has a PayPal order. Complete or void it before creating a separate replacement request.",
      );
    const rid = existing?.id || id();
    const version = (existing?.version || 0) + (value.confirm ? 1 : 0);
    if (existing)
      run(
        "UPDATE requests SET title=?,category=?,spec=?,status=?,version=?,updated_at=? WHERE id=? AND workspace_id=?",
        value.title,
        value.category,
        JSON.stringify(value.spec),
        value.confirm ? "Waiting for supplier" : "Draft",
        version,
        now(),
        rid,
        workspace.id,
      );
    else {
      const count = one<{ n: number }>(
        "SELECT COUNT(*) as n FROM requests WHERE workspace_id=?",
        workspace.id,
      )!.n;
      insert("requests", {
        id: rid,
        workspace_id: workspace.id,
        code: `PP-${1042 + count}`,
        title: value.title,
        category: value.category,
        status: value.confirm ? "Waiting for supplier" : "Draft",
        version,
        spec: JSON.stringify(value.spec),
        created_at: now(),
        updated_at: now(),
      });
    }
    if (value.confirm) {
      const assets = all<{ id: string }>(
        "SELECT id FROM assets WHERE request_id=? AND workspace_id=? AND role IN ('Original logo','Reference only','Required artwork','Specification')",
        rid,
        workspace.id,
      );
      insert("requirement_versions", {
        id: id(),
        workspace_id: workspace.id,
        request_id: rid,
        version,
        spec: JSON.stringify(value.spec),
        asset_ids: JSON.stringify(assets.map((a) => a.id)),
        created_at: now(),
      });
      run(
        "UPDATE agreements SET buyer_accepted=0,supplier_accepted=0 WHERE request_id=? AND workspace_id=?",
        rid,
        workspace.id,
      );
      audit(
        workspace.id,
        rid,
        "requirements",
        `Requirement version ${version} confirmed. Outreach limited to ${value.spec.supplierIds.length} selected suppliers and ${value.spec.maxContacts} additional candidates. New outreach still needs a launch confirmation.`,
      );
    }
    return { id: rid, version };
  })();
}
export function saveSupplier(workspace: Workspace, input: unknown) {
  const s = z
    .object({
      company: z.string().min(2).max(150),
      contact: z.string().max(100).default(""),
      email: z.union([z.email(), z.literal("")]).default(""),
      phone: z
        .union([z.string().regex(/^\+[1-9]\d{7,14}$/), z.literal("")])
        .default(""),
      location: z.string().max(200).default(""),
      category: z.string().max(100).default("General goods"),
      language: z.string().max(50).default("English"),
      channel: z.enum(["Email", "Phone"]).default("Email"),
      website: z
        .union([z.url().refine((v) => /^https?:\/\//.test(v)), z.literal("")])
        .default(""),
      notes: z.string().max(2000).default(""),
      relationship: z
        .enum(["Regular", "Previously used", "Newly discovered"])
        .default("Regular"),
    })
    .strict()
    .parse(input);
  const sid = id();
  insert("suppliers", {
    id: sid,
    workspace_id: workspace.id,
    ...s,
    verification: "Unknown",
    merchant_id: "",
    do_not_contact: 0,
    created_at: now(),
  });
  audit(
    workspace.id,
    null,
    "supplier",
    `${s.company} added to your supplier directory.`,
  );
  return { id: sid };
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function invitationByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new DomainError("This invitation is invalid or has expired.", 404);
  const inv = requireRecord(
    one<Invitation>(
      "SELECT * FROM invitations WHERE token_hash=? AND revoked=0 AND expires_at>?",
      tokenHash(token),
      now(),
    ),
  );
  const req = getRequest(inv.workspace_id, inv.request_id);
  if (req.version < 1)
    throw new DomainError("The buyer has not confirmed this request.", 409);
  return {
    inv,
    request: req,
    supplier: requireRecord(
      one<Supplier>(
        "SELECT * FROM suppliers WHERE id=? AND workspace_id=?",
        inv.supplier_id,
        inv.workspace_id,
      ),
    ),
  };
}
export function invite(
  workspace: Workspace,
  requestId: string,
  supplierId: string,
) {
  const req = getRequest(workspace.id, requestId);
  if (req.version < 1)
    throw new DomainError("Confirm your requirements first.");
  const supplier = requireRecord(
    one<Supplier>(
      "SELECT * FROM suppliers WHERE id=? AND workspace_id=?",
      supplierId,
      workspace.id,
    ),
  );
  if (supplier.do_not_contact)
    throw new DomainError("This supplier has declined further contact.");
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 86400000).toISOString();
  insert("invitations", {
    id: id(),
    workspace_id: workspace.id,
    request_id: requestId,
    supplier_id: supplierId,
    token_hash: tokenHash(token),
    expires_at: expires,
    revoked: 0,
    created_at: now(),
  });
  audit(
    workspace.id,
    requestId,
    "invitation",
    `Private quote invitation created for ${supplier.company}. It expires in 7 days. No message was sent.`,
  );
  return { url: `/quote/${token}`, expires };
}
export function portalData(token: string) {
  const { inv, request, supplier } = invitationByToken(token);
  const rv = requireRecord(
    one<{ asset_ids: string }>(
      "SELECT asset_ids FROM requirement_versions WHERE request_id=? AND version=?",
      request.id,
      request.version,
    ),
  );
  const allowed: string[] = JSON.parse(rv.asset_ids);
  const assets = all<Asset>(
    "SELECT id,name,mime,role,size FROM assets WHERE request_id=? AND workspace_id=?",
    request.id,
    inv.workspace_id,
  ).filter((a) => allowed.includes(a.id));
  const quotes = all<Quote>(
    "SELECT * FROM quotes WHERE supplier_id=? AND request_id=? ORDER BY version DESC",
    supplier.id,
    request.id,
  );
  const agreement = getAgreement(inv.workspace_id, request.id);
  const { spec } = request;
  return {
    title: request.title,
    code: request.code,
    version: request.version,
    buyer: requireRecord(
      one<Workspace>("SELECT * FROM workspaces WHERE id=?", inv.workspace_id),
    ).name,
    sample:
      one<Workspace>("SELECT * FROM workspaces WHERE id=?", inv.workspace_id)!
        .mode === "sample",
    supplier: { company: supplier.company },
    requirements: {
      description: spec.description,
      quantity: spec.quantity,
      unit: spec.unit,
      dimensions: spec.dimensions,
      material: spec.material,
      colour: spec.colour,
      exactText: spec.exactText,
      requiredElement: spec.requiredElement,
      visualNotes: spec.visualNotes,
      deadline: spec.deadline,
      destination: spec.destination,
      alternatives: spec.alternatives,
    },
    assets,
    quotes,
    agreement:
      agreement?.supplier_id === supplier.id
        ? {
            id: agreement.id,
            amount: agreement.amount,
            currency: agreement.currency,
            stage: agreement.stage,
            requirement_version: agreement.requirement_version,
            supplier_accepted: agreement.supplier_accepted,
          }
        : null,
    expires: inv.expires_at,
    demo: !!one(
      "SELECT request_id FROM demo_sessions WHERE request_id=? AND workspace_id=? UNION ALL SELECT request_id FROM request_intakes WHERE request_id=? AND workspace_id=?",
      request.id,
      inv.workspace_id,
      request.id,
      inv.workspace_id,
    ),
    paymentContact:
      one<{ account: string }>(
        "SELECT account FROM demo_payment_contacts WHERE request_id=? AND supplier_id=?",
        request.id,
        supplier.id,
      )?.account || "",
  };
}
export function submitQuote(token: string, input: unknown) {
  const { inv, request, supplier } = invitationByToken(token);
  const q = z
    .object({
      currency: z.enum(currencies),
      unitPrice: z.string(),
      quantity: z.number().int().min(1).max(1000000),
      shipping: z.string(),
      tax: z.string(),
      completionDate: z.iso.date(),
      validUntil: z.iso.date(),
      paymentTerms: z.string().min(3).max(1000),
      exclusions: z.string().max(2000),
      meetsRequirements: z.boolean(),
      decline: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const unit = minor(q.unitPrice),
    shipping = q.shipping === "" ? null : minor(q.shipping),
    tax = q.tax === "" ? null : minor(q.tax);
  const subtotal = unit * q.quantity;
  const total =
    shipping === null || tax === null ? null : subtotal + shipping + tax;
  if (subtotal > 100000000 || (total || 0) > 100000000)
    throw new DomainError("Quote exceeds the supported amount.");
  if (q.validUntil < new Date().toISOString().slice(0, 10))
    throw new DomainError("The quote expiry must be today or later.");
  return db().transaction(() => {
    const version = one<{ n: number }>(
      "SELECT COALESCE(MAX(version),0)+1 as n FROM quotes WHERE request_id=? AND supplier_id=?",
      request.id,
      supplier.id,
    )!.n;
    const qid = id();
    insert("quotes", {
      id: qid,
      workspace_id: inv.workspace_id,
      request_id: request.id,
      supplier_id: supplier.id,
      invitation_id: inv.id,
      version,
      requirement_version: request.version,
      currency: q.currency,
      unit_price: unit,
      quantity: q.quantity,
      subtotal,
      shipping,
      tax,
      total,
      completion_date: q.completionDate,
      valid_until: q.validUntil,
      payment_terms: q.paymentTerms,
      exclusions: q.exclusions,
      confirmed: 1,
      meets_requirements: q.meetsRequirements ? 1 : 0,
      declined: q.decline ? 1 : 0,
      created_at: now(),
    });
    audit(
      inv.workspace_id,
      request.id,
      "quote",
      `${supplier.company} ${q.decline ? "declined the request" : `submitted written quotation version ${version}`}.`,
    );
    if (!getAgreement(inv.workspace_id, request.id))
      run(
        "UPDATE requests SET status=?,updated_at=? WHERE id=?",
        "Comparing quotes",
        now(),
        request.id,
      );
    return { id: qid, version };
  })();
}
export function quoteProblems(q: Quote, request: PurchaseRequest): string[] {
  const reasons: string[] = [];
  if (q.requirement_version !== request.version)
    reasons.push("Outdated requirements");
  if (!q.confirmed) reasons.push("Awaiting written confirmation");
  if (q.declined) reasons.push("Supplier declined");
  if (q.shipping === null) reasons.push("Shipping not specified");
  if (q.tax === null) reasons.push("Tax not specified");
  if (q.currency !== request.spec.currency) reasons.push("Different currency");
  if (q.quantity !== request.spec.quantity) reasons.push("Different quantity");
  if (q.completion_date > request.spec.deadline)
    reasons.push("After your deadline");
  if (q.valid_until < new Date().toISOString().slice(0, 10))
    reasons.push("Quote expired");
  if (!q.meets_requirements) reasons.push("Requirements not confirmed");
  if (
    q.total !== null &&
    q.currency === request.spec.currency &&
    q.total > request.spec.budget
  )
    reasons.push("Over budget");
  return reasons;
}
export function selectQuote(
  workspace: Workspace,
  requestId: string,
  quoteId: string,
) {
  assertNoActivePayment(workspace.id, requestId);
  return db().transaction(() => {
    const request = getRequest(workspace.id, requestId);
    const quote = requireRecord(
      one<Quote>(
        "SELECT * FROM quotes WHERE id=? AND request_id=? AND workspace_id=?",
        quoteId,
        requestId,
        workspace.id,
      ),
    );
    const problems = quoteProblems(quote, request);
    if (problems.length)
      throw new DomainError(
        `Resolve before selecting: ${problems.join("; ")}.`,
      );
    const latest = one<Quote>(
      "SELECT * FROM quotes WHERE request_id=? AND supplier_id=? ORDER BY version DESC LIMIT 1",
      requestId,
      quote.supplier_id,
    );
    if (latest?.id !== quote.id)
      throw new DomainError("A newer supplier quotation is available.");
    const existing = getAgreement(workspace.id, requestId);
    if (
      existing &&
      one<Payment>(
        "SELECT * FROM payments WHERE agreement_id=? AND order_id IS NOT NULL",
        existing.id,
      )
    )
      throw new DomainError(
        "This agreement already has a PayPal order. It cannot be replaced.",
      );
    const rv = requireRecord(
      one<{ asset_ids: string }>(
        "SELECT asset_ids FROM requirement_versions WHERE request_id=? AND version=?",
        requestId,
        request.version,
      ),
    );
    const aid = existing?.id || id();
    if (existing)
      run(
        "UPDATE agreements SET supplier_id=?,quote_id=?,requirement_version=?,amount=?,currency=?,buyer_accepted=1,supplier_accepted=0,asset_ids=?,created_at=? WHERE id=?",
        quote.supplier_id,
        quote.id,
        request.version,
        quote.total,
        quote.currency,
        rv.asset_ids,
        now(),
        aid,
      );
    else
      insert("agreements", {
        id: aid,
        workspace_id: workspace.id,
        request_id: requestId,
        supplier_id: quote.supplier_id,
        quote_id: quote.id,
        requirement_version: request.version,
        amount: quote.total,
        currency: quote.currency,
        stage:
          request.category === "Beverage wholesale"
            ? "Stock delivery & invoice review"
            : "Artwork approval & production",
        buyer_accepted: 1,
        supplier_accepted: 0,
        asset_ids: rv.asset_ids,
        created_at: now(),
      });
    if (existing)
      run(
        "UPDATE payments SET amount=?,currency=?,status=?,updated_at=? WHERE agreement_id=?",
        quote.total,
        quote.currency,
        "Not started",
        now(),
        aid,
      );
    else
      insert("payments", {
        id: id(),
        workspace_id: workspace.id,
        request_id: requestId,
        agreement_id: aid,
        order_id: null,
        authorization_id: null,
        capture_id: null,
        status: "Not started",
        amount: quote.total,
        currency: quote.currency,
        refunded: 0,
        authorized_at: null,
        expires_at: null,
        approval_url: null,
        updated_at: now(),
      });
    run(
      "UPDATE requests SET status=?,updated_at=? WHERE id=?",
      "Waiting for agreement",
      now(),
      requestId,
    );
    audit(
      workspace.id,
      requestId,
      "agreement",
      `Buyer selected written quote version ${quote.version}. Supplier agreement is required before payment.`,
    );
    return { id: aid };
  })();
}
export function acceptAgreement(token: string) {
  const { inv, request, supplier } = invitationByToken(token);
  const a = requireRecord(getAgreement(inv.workspace_id, request.id));
  if (
    a.supplier_id !== supplier.id ||
    a.requirement_version !== request.version ||
    !a.buyer_accepted
  )
    throw new DomainError(
      "This agreement is not available for this invitation.",
      403,
    );
  run("UPDATE agreements SET supplier_accepted=1 WHERE id=?", a.id);
  audit(
    inv.workspace_id,
    request.id,
    "agreement",
    `${supplier.company} accepted agreement for requirement version ${request.version}.`,
  );
  return { accepted: true };
}
export function addSubmission(
  workspace: string,
  requestId: string,
  assetId: string,
) {
  assertNoActivePayment(workspace, requestId);
  if (
    one(
      "SELECT id FROM payments WHERE workspace_id=? AND request_id=? AND capture_id IS NOT NULL",
      workspace,
      requestId,
    )
  )
    throw new DomainError(
      "This stage has already been captured. Review a refund or create a replacement request before submitting new stage evidence.",
      409,
    );
  const req = getRequest(workspace, requestId);
  const a = requireRecord(getAgreement(workspace, requestId));
  if (
    !a.buyer_accepted ||
    !a.supplier_accepted ||
    a.requirement_version !== req.version
  )
    throw new DomainError(
      "Both parties must agree to the current requirements before a submission.",
    );
  const asset = requireRecord(
    one<Asset>(
      "SELECT * FROM assets WHERE id=? AND workspace_id=? AND request_id=? AND role=?",
      assetId,
      workspace,
      requestId,
      "Supplier submission",
    ),
  );
  return db().transaction(() => {
    const version = one<{ n: number }>(
      "SELECT COALESCE(MAX(version),0)+1 as n FROM submissions WHERE request_id=?",
      requestId,
    )!.n;
    const sid = id();
    insert("submissions", {
      id: sid,
      workspace_id: workspace,
      request_id: requestId,
      agreement_id: a.id,
      agreement_quote_id: a.quote_id,
      requirement_version: req.version,
      asset_id: asset.id,
      version,
      created_at: now(),
    });
    run(
      "UPDATE requests SET status=?,updated_at=? WHERE id=?",
      "Needs your review",
      now(),
      requestId,
    );
    audit(
      workspace,
      requestId,
      "submission",
      `Submission version ${version} received. Previous acceptance no longer applies.`,
    );
    return { id: sid, version };
  })();
}
export function latestSubmission(workspace: string, requestId: string) {
  return one<Submission>(
    "SELECT * FROM submissions WHERE workspace_id=? AND request_id=? ORDER BY version DESC LIMIT 1",
    workspace,
    requestId,
  );
}
export function latestReview(workspace: string, requestId: string) {
  const r = one<Review & { findings: string }>(
    "SELECT * FROM reviews WHERE workspace_id=? AND request_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
    workspace,
    requestId,
  );
  return r ? ({ ...r, findings: JSON.parse(r.findings) } as Review) : undefined;
}
export function reviewDecision(
  workspace: Workspace,
  requestId: string,
  decision: string,
  note: string,
  acknowledge: boolean,
) {
  assertNoActivePayment(workspace.id, requestId);
  if (!["accepted", "correction", "question"].includes(decision))
    throw new DomainError("Choose a review decision.");
  return db().transaction(() => {
    const request = getRequest(workspace.id, requestId);
    const a = requireRecord(getAgreement(workspace.id, requestId));
    const s = requireRecord(latestSubmission(workspace.id, requestId));
    const r = requireRecord(latestReview(workspace.id, requestId));
    if (
      r.submission_id !== s.id ||
      r.requirement_version !== request.version ||
      s.agreement_quote_id !== a.quote_id
    )
      throw new DomainError(
        "Run fresh checks against this submission and agreement.",
      );
    if (
      decision === "accepted" &&
      (r.findings.some((f) => f.result === "fail") || !acknowledge)
    )
      throw new DomainError(
        "Resolve failed checks and confirm that you reviewed all uncertain and visual requirements.",
      );
    if (decision !== "accepted" && !note.trim())
      throw new DomainError("Add a note for the supplier.");
    insert("reviews", {
      id: id(),
      workspace_id: workspace.id,
      request_id: requestId,
      submission_id: s.id,
      requirement_version: request.version,
      findings: JSON.stringify(r.findings),
      decision,
      note: note.slice(0, 3000),
      created_at: now(),
    });
    run(
      "UPDATE requests SET status=?,updated_at=? WHERE id=?",
      decision === "accepted"
        ? "Ready for payment"
        : decision === "correction"
          ? "Correction requested"
          : "Needs your review",
      now(),
      requestId,
    );
    audit(
      workspace.id,
      requestId,
      "review",
      decision === "accepted"
        ? `Buyer accepted submission version ${s.version}, including human review of uncertain findings.`
        : `${decision === "correction" ? "Correction requested" : "Question recorded"}: ${note.slice(0, 1000)} (not sent automatically)`,
    );
    return { decision };
  })();
}
export function paymentEligibility(workspace: string, requestId: string) {
  const request = getRequest(workspace, requestId),
    a = getAgreement(workspace, requestId),
    s = latestSubmission(workspace, requestId),
    r = latestReview(workspace, requestId);
  const reasons: string[] = [];
  if (!a || !a.buyer_accepted || !a.supplier_accepted)
    reasons.push("Buyer and supplier agreement required");
  if (a && a.requirement_version !== request.version)
    reasons.push("Requirements have changed");
  if (!s) reasons.push("Waiting for supplier evidence");
  if (
    s &&
    a &&
    (s.agreement_quote_id !== a.quote_id ||
      s.requirement_version !== request.version)
  )
    reasons.push("Submission belongs to an older agreement");
  if (
    !r ||
    r.submission_id !== s?.id ||
    r.requirement_version !== request.version ||
    r.decision !== "accepted"
  )
    reasons.push("Current evidence needs buyer acceptance");
  if (r?.findings.some((f) => f.result === "fail"))
    reasons.push("A requirement check failed");
  return { eligible: reasons.length === 0, reasons };
}
