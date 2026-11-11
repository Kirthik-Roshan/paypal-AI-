import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    db().prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
