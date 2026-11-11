"use client";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  FileText,
  LoaderCircle,
  Package,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
export function Button({
  children,
  variant = "primary",
  className = "",
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`btn btn-${variant} ${className}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "neutral" | "blue";
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  const tone = /fail|correction|expired/i.test(value)
    ? "red"
    : /review|pending|attention|approval|agreement/i.test(value)
      ? "amber"
      : /paid|captured|ready|accepted|connected|authorized|completed|confirmed|refunded|available/i.test(
            value,
          )
        ? "green"
        : "neutral";
  return <Badge tone={tone}>{value}</Badge>;
}
export function Field({
  label,
  hint,
  children,
  required = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  const control = isValidElement<{
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }>(children)
    ? cloneElement(children, {
        "aria-labelledby": labelId,
        ...(hint ? { "aria-describedby": hintId } : {}),
      })
    : children;
  return (
    <label className="field">
      <span className="field-label" id={labelId}>
        {label}
        {required && (
          <span className="required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      {control}
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
    </label>
  );
}
export function Empty({
  title,
  description,
  children,
  icon: Icon = Package,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  icon?: typeof Package;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Notice({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "green" | "red" | "neutral";
}) {
  return (
    <div className={`notice notice-${tone}`}>
      {tone === "green" ? (
        <ShieldCheck size={18} />
      ) : (
        <AlertTriangle size={18} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-head">
        <h2>{title}</h2>
        <button
          onClick={onClose}
          className="icon-btn"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Package size={21} strokeWidth={1.6} />
        <Check size={11} className="brand-check" strokeWidth={3} />
      </span>
      {!compact && (
        <span>
          Procure<span className="brand-light">Proof</span>
        </span>
      )}
    </span>
  );
}
export function FileIcon() {
  return (
    <span className="file-icon">
      <FileText size={20} />
    </span>
  );
}
export function External({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button onClick={onClick}>
      <Plus size={17} />
      {children}
    </Button>
  );
}
