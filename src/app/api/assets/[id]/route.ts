import { DomainError, one, requireRecord } from "@/lib/db";
import { invitationByToken } from "@/lib/domain";
import { apiError } from "@/lib/http";
import { sessionOptional } from "@/lib/session";
import type { Asset } from "@/lib/types";
import { NextResponse } from "next/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const aid = (await context.params).id;
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    let workspaceId = "";
    let allowed: string[] | null = null;
    let supplierId = "";
    let invitationRequestId = "";
    if (token) {
      const { inv, request: req, supplier } = invitationByToken(token);
      workspaceId = inv.workspace_id;
      supplierId = supplier.id;
      invitationRequestId = req.id;
      const row = requireRecord(
        one<{ asset_ids: string }>(
          "SELECT asset_ids FROM requirement_versions WHERE request_id=? AND version=?",
          req.id,
          req.version,
        ),
      );
      allowed = JSON.parse(row.asset_ids);
    } else {
      const w = await sessionOptional();
      if (!w) throw new DomainError("Sign in to view this file.", 401);
      workspaceId = w.id;
    }
    const asset = requireRecord(
      one<
        Asset & {
          content: Buffer;
          preview: string | null;
          supplier_id: string | null;
        }
      >("SELECT * FROM assets WHERE id=? AND workspace_id=?", aid, workspaceId),
    );
    if (
      allowed &&
      (asset.request_id !== invitationRequestId ||
        (!allowed.includes(aid) && asset.supplier_id !== supplierId))
    )
      throw new DomainError(
        "This file is not shared with your invitation.",
        403,
      );
    const headers = {
      "Content-Type": asset.mime,
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${asset.name}"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    };
    if (
      url.searchParams.has("preview") &&
      asset.preview?.startsWith("data:image/png;base64,")
    )
      return new NextResponse(
        new Uint8Array(Buffer.from(asset.preview.split(",")[1], "base64")),
        {
          headers: {
            ...headers,
            "Content-Type": "image/png",
            "Content-Disposition": "inline",
          },
        },
      );
    if (url.searchParams.has("preview") && asset.preview)
      return new NextResponse(asset.preview, {
        headers: {
          ...headers,
          "Content-Type": "image/svg+xml",
          "Content-Disposition": "inline",
        },
      });
    return new NextResponse(new Uint8Array(asset.content), { headers });
  } catch (e) {
    return apiError(e);
  }
}
