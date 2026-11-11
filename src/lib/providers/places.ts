import { z } from "zod";
import { DomainError } from "../db";
import type { Workspace } from "../types";

export async function nearbyBeverageSuppliers(
  w: Workspace,
  address: string,
  transport: typeof fetch = fetch,
) {
  if (w.mode !== "sandbox")
    throw new DomainError(
      "Connect owner sign-in in Settings before using the Google Places account. Teammate suppliers do not require discovery.",
      503,
    );
  if (!process.env.GOOGLE_PLACES_API_KEY)
    throw new DomainError(
      "Google Places setup required: set GOOGLE_PLACES_API_KEY and enable Places API (New) with billing.",
      503,
    );
  const location = z.string().trim().min(5).max(500).parse(address);
  const response = await transport(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.internationalPhoneNumber,places.attributions",
      },
      body: JSON.stringify({
        textQuery: `soft drink beverage wholesale suppliers near ${location}`,
        pageSize: 2,
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new DomainError(
      `Google Places returned ${response.status}. Check API access, billing and key restrictions.`,
      502,
    );
  const result = z
    .object({
      places: z
        .array(
          z.object({
            id: z.string(),
            displayName: z.object({ text: z.string() }),
            formattedAddress: z.string().optional(),
            googleMapsUri: z.url().optional(),
            internationalPhoneNumber: z.string().optional(),
            attributions: z
              .array(
                z.object({
                  provider: z.string().optional(),
                  providerUri: z.string().optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .parse(await response.json());
  // Return ephemeral provider results; do not persist Google listing content as our directory.
  return {
    places: (result.places || []).slice(0, 2),
    retrievedAt: new Date().toISOString(),
  };
}
