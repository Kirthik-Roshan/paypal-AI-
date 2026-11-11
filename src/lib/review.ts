import { extractText, getDocumentProxy } from "unpdf";
import { audit, DomainError, id, insert, now, one, requireRecord } from "./db";
import {
  assertNoActivePayment,
  getAgreement,
  getRequest,
  latestSubmission,
} from "./domain";
import type { Asset, Finding, Workspace } from "./types";

export async function analyzeSubmission(
  workspace: Workspace,
  requestId: string,
) {
  assertNoActivePayment(workspace.id, requestId);
  const request = getRequest(workspace.id, requestId),
    s = requireRecord(latestSubmission(workspace.id, requestId)),
    a = requireRecord(getAgreement(workspace.id, requestId));
  if (
    s.requirement_version !== request.version ||
    s.agreement_quote_id !== a.quote_id
  )
    throw new DomainError("Upload evidence for the current agreement.");
  const asset = requireRecord(
    one<Asset & { content: Buffer }>(
      "SELECT * FROM assets WHERE id=? AND workspace_id=?",
      s.asset_id,
      workspace.id,
    ),
  );
  let text = "";
  let pages = 0;
  if (asset.mime === "application/pdf") {
    try {
      const document = await getDocumentProxy(new Uint8Array(asset.content), {
        isEvalSupported: false,
        maxImageSize: 16_777_216,
        useSystemFonts: true,
      });
      try {
        if (document.numPages > 30)
          throw new DomainError("Document exceeds the 30-page analysis limit.");
        const parsed = await extractText(document, { mergePages: true });
        text = parsed.text;
        pages = parsed.totalPages;
      } finally {
        await document.destroy();
      }
    } catch {
      /* unreadable evidence stays unknown */
    }
  }
  const readable = text.trim().length > 20;
  const normalized = text.replace(/\s+/g, " ").trim();
  const source = asset.name;
  const location = pages
    ? `Extracted PDF text · ${pages} page${pages === 1 ? "" : "s"}`
    : "Uploaded image or unreadable PDF";
  const findings: Finding[] = [];
  const exact = (
    requirementId: string,
    label: string,
    value: string,
    forceUnknown = false,
  ) => {
    if (!value.trim()) return;
    const pass = normalized.includes(value.replace(/\s+/g, " ").trim());
    findings.push({
      requirementId,
      label,
      result: forceUnknown || !readable ? "unknown" : pass ? "pass" : "fail",
      source,
      location,
      explanation: forceUnknown
        ? "Document text cannot establish the presence or appearance of a logo. Review the actual artwork."
        : !readable
          ? "No readable document text. This requirement needs visual review."
          : pass
            ? `Found exact text “${value}” in this document.`
            : `Required text “${value}” was not found in the extracted document text.`,
      correction:
        pass && !forceUnknown
          ? ""
          : `Confirm or correct “${value}” in the supplier artwork.`,
      method: forceUnknown ? "Human review" : "Deterministic",
    });
  };
  exact("REQ-TEXT", "Exact printed text / phone", request.spec.exactText);
  exact(
    "REQ-ELEMENT",
    "Required element / wording",
    request.spec.requiredElement,
  );
  exact("REQ-DIM", "Documented dimensions", request.spec.dimensions);
  if (readable) {
    const matches = [...normalized.matchAll(/Quantity:\s*(\d[\d,]*)/gi)].map(
      (m) => Number(m[1].replaceAll(",", "")),
    );
    findings.push({
      requirementId: "REQ-QTY",
      label: "Documented quantity",
      result:
        matches.length === 1
          ? matches[0] === request.spec.quantity
            ? "pass"
            : "fail"
          : "unknown",
      source,
      location,
      explanation:
        matches.length === 1
          ? `Document states ${matches[0]} ${request.spec.unit}; agreement requires ${request.spec.quantity}. This does not verify physical quantity.`
          : "No single labelled quantity was found in the document.",
      correction:
        matches[0] === request.spec.quantity
          ? ""
          : "Confirm the required quantity in the submitted document.",
      method: "Deterministic",
    });
  }
  findings.push({
    requirementId: "REQ-VISUAL",
    label:
      request.category === "Beverage wholesale"
        ? "Seals, expiry dates, pack size & delivered condition"
        : "Logo, material & visual finish",
    result: "unknown",
    source,
    location: "Visual and physical review",
    explanation:
      request.category === "Beverage wholesale"
        ? "Inspect the actual delivered cases, brand/flavours, pack size, expiry dates and seals. A document or shelf photo cannot establish physical count or food quality."
        : "Inspect logo placement and visual preferences. Artwork cannot establish physical dimensions, material, or delivered quality.",
    correction:
      request.category === "Beverage wholesale"
        ? "Confirm physical delivery and invoice terms with the supplier before accepting the stage."
        : "Review the artwork and confirm any physical requirements with the supplier.",
    method: "Human review",
  });
  // A payment can start while the file is being parsed. Do not invalidate its
  // reviewed evidence in the middle of a financial operation.
  assertNoActivePayment(workspace.id, requestId);
  insert("reviews", {
    id: id(),
    workspace_id: workspace.id,
    request_id: requestId,
    submission_id: s.id,
    requirement_version: request.version,
    findings: JSON.stringify(findings),
    decision: "pending",
    note: "Local PDF text checks. Visual assessment requires owner review.",
    created_at: now(),
  });
  audit(
    workspace.id,
    requestId,
    "analysis",
    `Fresh document checks for submission version ${s.version}: ${findings.filter((f) => f.result === "fail").length} failed, ${findings.filter((f) => f.result === "unknown").length} need human review. No payment action performed.`,
  );
  return { findings };
}
