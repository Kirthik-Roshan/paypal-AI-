import { z } from "zod";
import {
  all,
  audit,
  db,
  DomainError,
  insert,
  now,
  one,
  requireRecord,
  run,
} from "./db";
import { defaultSpec } from "./defaults";
import { getRequest, saveRequest, saveSupplier } from "./domain";
import type { Workspace } from "./types";

export const demoConfigSchema = z
  .object({
    business: z.string().trim().min(2).max(100),
    address: z.string().trim().max(500),
    need: z.string().trim().max(3000),
    quantity: z.number().int().min(0).max(100000),
    pack: z.string().trim().max(200),
    currency: z.enum(["USD", "INR", "EUR", "GBP", "AUD", "CAD"]),
    budget: z.number().int().min(0).max(100000000),
    deadline: z.union([z.iso.date(), z.literal("")]),
    language: z.enum([
      "English",
      "Tamil",
      "Hindi",
      "Telugu",
      "Malayalam",
      "Kannada",
    ]),
    prithishPhone: z.union([
      z.literal(""),
      z.string().regex(/^\+[1-9]\d{7,14}$/),
    ]),
    karthickPhone: z.union([
      z.literal(""),
      z.string().regex(/^\+[1-9]\d{7,14}$/),
    ]),
  })
  .strict();
export type DemoConfig = z.infer<typeof demoConfigSchema>;
export type DemoMessage = { role: "buyer" | "assistant"; text: string };
export type DemoSession = {
  requestId: string;
  config: DemoConfig;
  messages: DemoMessage[];
  confirmed: boolean;
};
type Row = {
  request_id: string;
  config: string;
  messages: string;
  confirmed: number;
};
export function demoState(w: Workspace): DemoSession | null {
  const row = one<Row>(
    "SELECT * FROM demo_sessions WHERE workspace_id=?",
    w.id,
  );
  return row
    ? {
        requestId: row.request_id,
        config: JSON.parse(row.config),
        messages: JSON.parse(row.messages),
        confirmed: !!row.confirmed,
      }
    : null;
}
export function startDemo(w: Workspace) {
  const existing = demoState(w);
  if (existing) return existing;
  if (w.mode === "sample")
    throw new DomainError(
      "Return to your business workspace in Settings to start the supermarket demo. The Juniper sample stays separate.",
    );
  return db().transaction(() => {
    const existing = demoState(w);
    if (existing) return existing;
    const config: DemoConfig = {
      business: w.name,
      address: "",
      need: "",
      quantity: 0,
      pack: "",
      currency: "USD",
      budget: 0,
      deadline: "",
      language: "English",
      prithishPhone: "",
      karthickPhone: "",
    };
    const req = saveRequest(w, {
      title: "[Hackathon] Soft-drink restock",
      category: "Beverage wholesale",
      spec: {
        ...defaultSpec(),
        description: "Unconfirmed supermarket restock intake",
        unit: "cases",
      },
      confirm: false,
    });
    const messages: DemoMessage[] = [
      {
        role: "assistant",
        text: "What’s running low at your supermarket? Tell me what you need in your own words. You can attach a stock report or shelf photo. I’ll build a restock brief and ask for missing details. Prithish is your regular supplier and Karthick plays the nearby alternative in this hackathon. I won’t contact anyone until you confirm.",
      },
    ];
    insert("demo_sessions", {
      workspace_id: w.id,
      request_id: req.id,
      config: JSON.stringify(config),
      messages: JSON.stringify(messages),
      confirmed: 0,
      created_at: now(),
    });
    audit(
      w.id,
      req.id,
      "demo",
      "Supermarket hackathon scenario opened. No offers, calls or payments were seeded.",
    );
    return demoState(w)!;
  })();
}
export function saveDemo(w: Workspace, input: unknown) {
  const data = z
    .object({
      config: demoConfigSchema,
      message: z.string().trim().max(3000).optional(),
      confirm: z.boolean().default(false),
    })
    .parse(input);
  return db().transaction(() => {
    const state = requireRecord(demoState(w) || undefined);
    if (state.confirmed)
      throw new DomainError(
        "This demo brief is frozen. Use Revise requirements on the request to change the agreed specification.",
        409,
      );
    const c = data.config;
    const messages = [...state.messages];
    if (data.message) {
      if (messages.length >= 100)
        throw new DomainError(
          "The demo conversation has reached its limit. Confirm your brief to continue.",
        );
      messages.push(
        { role: "buyer", text: data.message },
        {
          role: "assistant",
          text: "I’ve saved that as buyer context. Please update the quantity, pack size, budget and delivery fields below to match your message. I won’t infer commercial terms from notes or images. Once confirmed, you can invite Prithish and Karthick to quote and compare their actual offers.",
        },
      );
    }
    const supplierIds: string[] = [];
    if (data.confirm) {
      const missing = missingDemoFields(c);
      if (missing.length)
        throw new DomainError(
          `Please provide ${missing.join(", ")} before confirming.`,
        );
      if (!c.address.trim())
        throw new DomainError("Enter the supermarket delivery address first.");
      if (c.prithishPhone && c.prithishPhone === c.karthickPhone)
        throw new DomainError(
          "Use a different phone number for each teammate.",
        );
      for (const [name, phone, relationship] of [
        ["Prithish", c.prithishPhone, "Regular"],
        ["Karthick", c.karthickPhone, "Newly discovered"],
      ]) {
        supplierIds.push(
          saveSupplier(w, {
            company: `${name} · hackathon supplier`,
            contact: name,
            phone,
            location: c.address,
            category: "Beverage wholesale",
            language: c.language,
            channel: "Phone",
            relationship,
            notes:
              "Teammate acting as supplier in the supermarket demo. Not a Google Places discovery. Phone and payment identity require verification.",
          }).id,
        );
      }
    }
    saveRequest(w, {
      id: state.requestId,
      title: "[Hackathon] Soft-drink restock",
      category: "Beverage wholesale",
      spec: {
        ...getRequest(w.id, state.requestId).spec,
        description: `${c.need}\nBuyer business: ${c.business}`,
        quantity: c.quantity || 1,
        unit: "cases",
        material: c.pack,
        requiredElement: "",
        dimensions: "",
        exactText: "",
        destination: c.address,
        region: c.address,
        currency: c.currency,
        budget: c.budget || 1,
        deadline: c.deadline || defaultSpec().deadline,
        language: c.language,
        channel: "Phone",
        supplierIds,
        discover: false,
        maxContacts: 3,
        visualNotes:
          "Check stock condition, expiry, pack size and quantity on delivery. Photos alone do not prove quantity or freshness.",
      },
      confirm: data.confirm,
    });
    run(
      "UPDATE demo_sessions SET config=?,messages=?,confirmed=? WHERE workspace_id=?",
      JSON.stringify(c),
      JSON.stringify(messages),
      data.confirm ? 1 : 0,
      w.id,
    );
    return demoState(w)!;
  })();
}
export function missingDemoFields(c: DemoConfig) {
  return [
    !c.need && "drink brands/flavours",
    !c.address && "store delivery address",
    !c.quantity && "number of cases",
    !c.pack && "pack size",
    !c.budget && "total budget and currency",
    !c.deadline && "delivery date",
    !c.prithishPhone && "Prithish’s phone number",
    !c.karthickPhone && "Karthick’s phone number",
  ].filter(Boolean) as string[];
}
export function demoSuppliers(w: Workspace) {
  const state = requireRecord(demoState(w) || undefined);
  const req = getRequest(w.id, state.requestId);
  return all<{
    id: string;
    phone: string;
    contact: string;
    do_not_contact: number;
  }>(
    "SELECT id,phone,contact,do_not_contact FROM suppliers WHERE workspace_id=?",
    w.id,
  ).filter((s) => req.spec.supplierIds.includes(s.id));
}
