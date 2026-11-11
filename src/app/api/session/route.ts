import { apiError } from "@/lib/http";
import { openWorkspace, rateLimit, sameOrigin } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    rateLimit(
      `session:${request.headers.get("x-forwarded-for") || "local"}`,
      20,
    );
    const { mode, name, timezone } = z
      .object({
        mode: z.enum(["local", "sample", "sandbox"]),
        name: z.string().trim().min(2).max(100).optional(),
        timezone: z.string().default("Asia/Kolkata"),
      })
      .parse(await request.json());
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      throw new Error("Invalid time zone");
    }
    return NextResponse.json(
      await openWorkspace(mode, name ? { name, timezone } : undefined),
    );
  } catch (e) {
    return apiError(e);
  }
}
