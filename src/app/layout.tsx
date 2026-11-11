import type { Metadata } from "next";
import "./globals.css";
import "./paypal-theme.css";
export const metadata: Metadata = {
  title: "ProcureProof — Purchasing with confidence",
  description:
    "From supplier conversation to verified payment. A calm procurement workspace with evidence at every step.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
