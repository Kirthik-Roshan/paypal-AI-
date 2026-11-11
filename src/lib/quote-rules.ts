import type { PurchaseRequest, Quote } from "./types";
export function quoteProblems(q: Quote, request: PurchaseRequest): string[] {
  const reasons: string[] = [];
  if (q.requirement_version !== request.version)
    reasons.push("Outdated requirements");
  if (!q.confirmed) reasons.push("Awaiting written confirmation");
  if (q.declined) reasons.push("Supplier declined");
  if (q.shipping === null) reasons.push("Shipping not specified");
  if (q.tax === null) reasons.push("Tax not specified");
  if (q.currency !== request.spec.currency) reasons.push("Different currency");
  if (q.quantity !== request.spec.quantity) reasons.push("Different quantity");
  if (q.completion_date > request.spec.deadline)
    reasons.push("After your deadline");
  if (q.valid_until < new Date().toISOString().slice(0, 10))
    reasons.push("Quote expired");
  if (!q.meets_requirements) reasons.push("Requirements not confirmed");
  if (
    q.total !== null &&
    q.currency === request.spec.currency &&
    q.total > request.spec.budget
  )
    reasons.push("Over budget");
  return reasons;
}
