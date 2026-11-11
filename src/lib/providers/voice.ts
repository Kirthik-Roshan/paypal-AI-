import { DomainError } from "../db";
import { getRequest } from "../domain";
import type { Workspace } from "../types";

// Sarvam's documented instant outbound API does not document a signature
// mechanism. Do not invent one or trust callback bodies as authenticated.
export function launchOutreach(workspace: Workspace, requestId: string) {
  getRequest(workspace.id, requestId);
  throw new DomainError(
    workspace.mode === "sample"
      ? "Sample walkthrough cannot place calls. Connect Sarvam and verify account capabilities in Settings."
      : "Calling is blocked until the Sarvam account, allowlisted consenting test number, supported destination, agent policy and authenticated callback path are verified. See Settings and docs/SARVAM_SETUP.md.",
    503,
  );
}
export function procurementInstructions(business: string, summary: string) {
  return `You are an AI purchasing assistant for ${business}. Identify yourself and ask permission to continue. This is an enquiry, not a binding order.\n${summary}\nAsk for unit price, tax, shipping, quantity breaks, delivery, payment terms and written confirmation. Repeat critical numbers. Never reveal competing offers. Negotiate unit price only within the approved limit; ask the owner before changing quantity, specifications, deadline or currency. Do not issue payment instructions, place orders or promise payment. Respect a request to stop contact. Escalate uncertainty to the owner.`;
}
