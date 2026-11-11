import { DomainError } from "@/lib/db";
import { apiError } from "@/lib/http";
import {
  processPaypalWebhook,
  verifyPaypalWebhook,
} from "@/lib/providers/paypal";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 1024 * 1024)
      throw new DomainError("Event too large.", 413);
    const event = JSON.parse(raw);
    await verifyPaypalWebhook(request.headers, event);
    return NextResponse.json(
      await processPaypalWebhook(event, undefined, true),
    );
  } catch (e) {
    return apiError(e);
  }
}
