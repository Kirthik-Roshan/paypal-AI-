import { getData } from "@/lib/domain";
import { apiError } from "@/lib/http";
import { integrationHealth } from "@/lib/providers/config";
import { session } from "@/lib/session";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const w = await session();
    return NextResponse.json(
      { ...getData(w), integrations: integrationHealth() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
