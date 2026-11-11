import { DomainError } from "./db";
export const currencies = ["USD", "INR", "EUR", "GBP", "AUD", "CAD"] as const;
export function minor(value: string | number): number {
  const s = String(value).trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s))
    throw new DomainError(
      "Use a positive amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = s.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000)
    throw new DomainError("Amount exceeds the supported limit.");
  return result;
}
export const decimal = (amount: number) =>
  `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
