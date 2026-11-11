import { apiError } from "@/lib/http";
import { rateLimit, sameOrigin, session } from "@/lib/session";
import { upload } from "@/lib/uploads";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const w = await session();
    rateLimit(`upload:${w.id}`, 30);
    return NextResponse.json(await upload(w, await request.formData()));
  } catch (e) {
    return apiError(e);
  }
}
