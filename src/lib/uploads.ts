import { createHash } from "node:crypto";
import { z } from "zod";
import {
  audit,
  DomainError,
  id,
  insert,
  now,
  one,
  requireRecord,
  run,
} from "./db";
import { addSubmission, getRequest } from "./domain";
import { pdfPreview } from "./pdf";
import type { Asset, Workspace } from "./types";

export const assetRoles = [
  "Buyer context",
  "Original logo",
  "Reference only",
  "Required artwork",
  "Specification",
  "Quotation PDF",
  "Supplier submission",
] as const;
export function validateFile(name: string, mime: string, bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024)
    throw new DomainError("Choose a file between 1 byte and 10 MB.");
  const ext = name.split(".").pop()?.toLowerCase();
  const valid =
    (ext === "pdf" &&
      mime === "application/pdf" &&
      bytes.subarray(0, 5).toString() === "%PDF-") ||
    (ext === "png" &&
      mime === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (["jpg", "jpeg"].includes(ext || "") &&
      mime === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (ext === "webp" &&
      mime === "image/webp" &&
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP");
  if (!valid)
    throw new DomainError(
      "Upload a genuine PDF, PNG, JPEG, or WebP file. Scripts and executable artwork are not accepted.",
    );
}
export function storeAsset(
  workspace: string,
  requestId: string,
  name: string,
  mime: string,
  bytes: Buffer,
  role: string,
  preview: string | null = null,
) {
  const aid = id();
  insert("assets", {
    id: aid,
    workspace_id: workspace,
    request_id: requestId,
    name: name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 150),
    mime,
    role,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    content: bytes,
    preview,
    created_at: now(),
  });
  return aid;
}
export async function upload(
  workspace: Workspace,
  form: FormData,
  portalRequestId?: string,
) {
  const requestId =
    portalRequestId || z.string().min(1).parse(form.get("requestId"));
  const request = getRequest(workspace.id, requestId);
  const role = z.enum(assetRoles).parse(form.get("role"));
  if (
    portalRequestId &&
    !["Supplier submission", "Quotation PDF"].includes(role)
  )
    throw new DomainError(
      "This invitation cannot upload buyer reference files.",
      403,
    );
  if (
    !portalRequestId &&
    request.version > 0 &&
    !["Supplier submission", "Quotation PDF"].includes(role)
  )
    throw new DomainError(
      "Approved reference files are frozen. Create a requirement revision to replace them.",
    );
  const file = form.get("file");
  if (!(file instanceof File)) throw new DomainError("Choose a file first.");
  const bytes = Buffer.from(await file.arrayBuffer());
  validateFile(file.name, file.type, bytes);
  const preview =
    file.type === "application/pdf" ? await pdfPreview(bytes) : null;
  const aid = storeAsset(
    workspace.id,
    requestId,
    file.name,
    file.type,
    bytes,
    role,
    preview,
  );
  try {
    if (role === "Supplier submission")
      addSubmission(workspace.id, requestId, aid);
  } catch (e) {
    run("DELETE FROM assets WHERE id=?", aid);
    throw e;
  }
  audit(
    workspace.id,
    requestId,
    "file",
    `${file.name} uploaded as ${role.toLowerCase()}.`,
  );
  return { id: aid };
}
export function removeAsset(workspace: Workspace, assetId: string) {
  const asset = requireRecord(
    one<Asset>(
      "SELECT * FROM assets WHERE id=? AND workspace_id=?",
      assetId,
      workspace.id,
    ),
  );
  const r = getRequest(workspace.id, asset.request_id);
  if (
    r.version > 0 ||
    one("SELECT id FROM submissions WHERE asset_id=?", assetId)
  )
    throw new DomainError(
      "Files used in a confirmed requirement or submission are preserved in the audit trail.",
    );
  run(
    "DELETE FROM assets WHERE id=? AND workspace_id=?",
    assetId,
    workspace.id,
  );
  return { removed: true };
}
