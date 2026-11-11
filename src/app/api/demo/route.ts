import { apiError } from "@/lib/http";
import { demoState, saveDemo, startDemo } from "@/lib/demo";
import { rateLimit, sameOrigin, session } from "@/lib/session";
import { nearbyBeverageSuppliers } from "@/lib/providers/places";
import { launchDemoCall, syncDemoCall } from "@/lib/providers/demo-voice";
import { NextResponse } from "next/server";
import { z } from "zod";
import { intakeMessage } from "@/lib/providers/intake";
import { all } from "@/lib/db";
const capability = () => ({
  modelConfigured: !!(
    process.env.GEMINI_API_KEY && process.env.GEMINI_INTAKE_MODEL
  ),
  placesConfigured: !!process.env.GOOGLE_PLACES_API_KEY,
});
export async function GET() {
  try {
    const w = await session();
    return NextResponse.json(
      {
        demo: demoState(w),
        paymentContacts: all(
          "SELECT supplier_id,account FROM demo_payment_contacts WHERE workspace_id=?",
          w.id,
        ),
        ...capability(),
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
    rateLimit(`demo:${w.id}`, 40);
    const body = z
      .object({
        action: z.enum(["start", "save", "chat", "places", "call", "sync"]),
        data: z.any().optional(),
      })
      .parse(await request.json());
    const d = body.data || {};
    if (body.action === "start")
      return NextResponse.json({ demo: startDemo(w) });
    if (body.action === "save")
      return NextResponse.json({ demo: saveDemo(w, d) });
    if (body.action === "chat")
      return NextResponse.json(await intakeMessage(w, d));
    if (body.action === "places")
      return NextResponse.json(
        await nearbyBeverageSuppliers(w, z.string().parse(d.address)),
      );
    if (body.action === "call")
      return NextResponse.json(
        await launchDemoCall(
          w,
          z.string().parse(d.supplierId),
          d.consent === true,
        ),
      );
    return NextResponse.json(await syncDemoCall(w, z.string().parse(d.callId)));
  } catch (e) {
    return apiError(e);
  }
}
