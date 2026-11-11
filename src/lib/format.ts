export function money(amount: number | null | undefined, currency = "USD") {
  return amount == null
    ? "Not specified"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount / 100);
}
export function date(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
    ...options,
  }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
}
export function relative(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : date(value);
}
export function futureDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
