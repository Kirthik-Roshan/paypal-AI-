import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createIntake,
  readIntake,
  saveIntake,
  chatIntake,
} from "@/lib/request-intake";
import { apiError } from "@/lib/http";
import { rateLimit, sameOrigin, session } from "@/lib/session";
export async function GET(request: Request) {
  try {
    const w = await session();
    const rid = new URL(request.url).searchParams.get("requestId");
    return NextResponse.json(
      {
        intake: rid ? readIntake(w, rid) : null,
        configured: !!(
          process.env.OPENAI_API_KEY && process.env.OPENAI_INTAKE_MODEL
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const w = await session();
    rateLimit(`intake:${w.id}`, 30);
    const body = z
      .object({
        action: z.enum(["create", "save", "chat"]),
        requestId: z.string().optional(),
        data: z.any().optional(),
      })
      .parse(await request.json());
    const intake =
      body.action === "create"
        ? createIntake(w, body.requestId)
        : body.action === "chat"
          ? await chatIntake(w, z.string().parse(body.requestId), body.data)
          : saveIntake(w, z.string().parse(body.requestId), body.data);
    return NextResponse.json({ intake });
  } catch (e) {
    return apiError(e);
  }
}
