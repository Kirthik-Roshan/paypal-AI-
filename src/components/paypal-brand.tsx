export function PayPalMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`paypal-mark ${className}`}
      width="34"
      height="40"
      viewBox="0 0 38 44"
      aria-hidden="true"
    >
      <path
        fill="#003087"
        d="M10 3h14c9 0 13 5 11 13-2 9-8 13-17 13h-4l-2 12H3z"
      />
      <path
        fill="#009cde"
        d="M15 12h12c8 0 11 4 9 11-2 8-7 11-15 11h-3l-1 9H9z"
      />
      <path fill="#001c64" d="M15 12h10c4 0 7 1 9 3-1 9-7 14-16 14h-5z" />
    </svg>
  );
}
export function PayPalBrand({
  powered = false,
  className = "",
}: {
  powered?: boolean;
  className?: string;
}) {
  return (
    <span className={`paypal-brand ${className}`}>
      <PayPalMark />
      {powered && <span className="powered-label">Powered by</span>}
      <span className="paypal-wordmark">
        <span>Pay</span>
        <span>Pal</span>
      </span>
    </span>
  );
}
