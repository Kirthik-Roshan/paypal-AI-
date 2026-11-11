"use client";
import { useEffect } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { isSandboxApprovalUrl } from "@/lib/paypal-approval-url";
import { PayPalBrand } from "./paypal-brand";
import { Button, Modal } from "./ui";
export function PayPalHandoff({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const valid = isSandboxApprovalUrl(url);
  useEffect(() => {
    if (!valid) return;
    const timer = setTimeout(() => window.location.assign(url), 1600);
    return () => clearTimeout(timer);
  }, [url, valid]);
  return (
    <Modal title="Continue to PayPal" onClose={onClose}>
      <div className="paypal-handoff">
        <PayPalBrand powered />
        {valid ? (
          <>
            <span className="handoff-lock">
              <LockKeyhole size={27} />
            </span>
            <h3>One secure step to your approval.</h3>
            <p>
              You’re heading to PayPal Sandbox to review this order and approve
              the authorization.
            </p>
            <div
              className="handoff-progress"
              aria-label="Opening PayPal Sandbox"
              role="status"
            >
              <span />
            </div>
            <div className="handoff-destination">
              <ShieldCheck size={17} />
              <span>PayPal Sandbox · simulated funds</span>
            </div>
            <small>
              Returning here does not confirm payment. We verify the order with
              PayPal before updating its status.
            </small>
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>
                Stay here
              </Button>
              <a href={url} className="btn btn-primary">
                Continue to PayPal
                <ArrowRight size={15} />
              </a>
            </div>
          </>
        ) : (
          <>
            <h3>Check the approval destination.</h3>
            <p role="alert">
              This is not a valid PayPal Sandbox approval URL. No redirect was
              made.
            </p>
            <Button variant="secondary" onClick={onClose}>
              Return to payment details
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
