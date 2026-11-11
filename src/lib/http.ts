import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "./db";
export function apiError(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 5)
          .join("; "),
      },
      { status: 400 },
    );
  if (e instanceof DomainError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(
    "[ProcureProof]",
    e instanceof Error ? e.message : "Unexpected server error",
  );
  return NextResponse.json(
    {
      error:
        "This action could not be completed. Your existing records are safe. Please try again.",
    },
    { status: 500 },
  );
}
