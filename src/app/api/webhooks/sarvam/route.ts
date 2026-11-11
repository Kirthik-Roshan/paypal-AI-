import { NextResponse } from "next/server";
// No documented authenticated callback mechanism has been verified for this
// account. Never let an untrusted payload create transcripts or quote facts.
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Sarvam callback authentication has not been configured and verified. No event was processed.",
    },
    { status: 503 },
  );
}
