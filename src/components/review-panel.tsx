"use client";
import { date } from "@/lib/format";
import type { Asset, Finding, PurchaseRequest } from "@/lib/types";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Download,
  FileSearch,
  FileText,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, Field, Modal, Notice } from "./ui";
function DocumentPreview({
  asset,
  label,
  version,
}: {
  asset?: Asset;
  label: string;
  version: string;
}) {
  const [zoom, setZoom] = useState(1);
  const source = asset ? `/api/assets/${asset.id}` : "";
  return (
    <section className="document-panel">
      <div className="document-panel-head">
        <span className="doc-title">
          <FileText size={16} />
          {label}
        </span>
        <Badge>{version}</Badge>
      </div>
      <div className="document-filename">
        {asset?.name || "No file attached"}
        {asset && (
          <a
            href={`${source}?download=1`}
            className="icon-btn"
            aria-label={`Download ${asset.name}`}
          >
            <Download size={15} />
          </a>
        )}
      </div>
      <div className="doc-viewport">
        {asset ? (
          <div className="doc-zoom-area" style={{ width: `${zoom * 100}%` }}>
            {asset.preview || asset.mime.startsWith("image/") ? (
              <img
                src={asset.preview ? `${source}?preview=1` : source}
                alt={asset.name}
                className="artwork-preview"
              />
            ) : (
              <iframe
                title={asset.name}
                src={`${source}#zoom=${zoom * 100}&toolbar=0&navpanes=0`}
                className="pdf-frame"
              />
            )}
          </div>
        ) : (
          <div className="document-empty">
            <FileText size={32} strokeWidth={1} />
            <p>Text requirements are preserved in the confirmed brief.</p>
          </div>
        )}
      </div>
      <div className="document-controls">
        <div>
          <button
            className="icon-btn"
            aria-label={`Zoom out ${label}`}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            disabled={!asset || zoom <= 0.5}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-btn"
            aria-label={`Zoom in ${label}`}
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            disabled={!asset || zoom >= 3}
          >
            <Plus size={14} />
          </button>
        </div>
        {asset && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            Open original
            <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </section>
  );
}
function FindingRow({
  finding: f,
  assetId,
}: {
  finding: Finding;
  assetId: string;
}) {
  const [open, setOpen] = useState(f.result === "fail");
  const Icon =
    f.result === "pass"
      ? CheckCircle2
      : f.result === "fail"
        ? XCircle
        : CircleHelp;
  return (
    <div className={`finding finding-${f.result}`}>
      <button
        className="finding-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Icon size={18} />
        <span>
          <strong>{f.label}</strong>
          <small>
            {f.result === "pass"
              ? "Text matches"
              : f.result === "fail"
                ? "Correction needed"
                : "Needs your review"}
          </small>
        </span>
        <ChevronDown size={15} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="finding-detail">
          <span className="finding-method">
            {f.method} · {f.requirementId}
          </span>
          <p>{f.explanation}</p>
          {f.correction && <p className="finding-correction">{f.correction}</p>}
          <a
            href={`/api/assets/${assetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="evidence-source"
          >
            <FileText size={12} />
            {f.source}
            <ArrowUpRight size={12} />
          </a>
          <small>{f.location}</small>
        </div>
      )}
    </div>
  );
}
export function EvidenceReview({ request: r }: { request: PurchaseRequest }) {
  const { data, action, uploadFile } = useWorkspace();
  const [mobileTab, setMobileTab] = useState("checks"),
    [fixture, setFixture] = useState("correct"),
    [busy, setBusy] = useState(""),
    [decision, setDecision] = useState(""),
    [note, setNote] = useState(""),
    [acknowledge, setAcknowledge] = useState(false),
    [viewSub, setViewSub] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [referenceId, setReferenceId] = useState("");
  const a = data.agreements.find((a) => a.request_id === r.id);
  const submissions = data.submissions.filter((s) => s.request_id === r.id);
  const latest = submissions[0];
  const viewed = submissions.find((s) => s.id === viewSub) || latest;
  const asset = data.assets.find((a) => a.id === viewed?.asset_id);
  const referenceIds: string[] = a ? JSON.parse(a.asset_ids) : [];
  const references = data.assets.filter(
    (file) =>
      file.request_id === r.id &&
      (referenceIds.includes(file.id) || file.role === "Buyer context"),
  );
  const selectedReference =
    references.find((file) => file.id === referenceId) ||
    references.find((file) => referenceIds.includes(file.id)) ||
    references[0];
  const reference =
    selectedReference && referenceIds.includes(selectedReference.id)
      ? selectedReference
      : undefined;
  const privateReference = reference ? undefined : selectedReference;
  const review = data.reviews.find(
    (v) =>
      v.request_id === r.id &&
      v.submission_id === latest?.id &&
      v.requirement_version === r.version,
  );
  const findings = review?.findings || [];
  const failed = findings.filter((f) => f.result === "fail").length;
  const unknown = findings.filter((f) => f.result === "unknown").length;
  const job = data.jobs.find(
    (j) =>
      j.request_id === r.id &&
      j.kind === "analysis" &&
      ["queued", "running"].includes(j.status),
  );
  const failedJob = data.jobs.find(
    (j) =>
      j.request_id === r.id && j.kind === "analysis" && j.status === "failed",
  );
  useEffect(() => {
    setAcknowledge(false);
    setViewSub("");
  }, [latest?.id]);
  async function example() {
    setBusy("example");
    try {
      await action(
        "sample.submission",
        r.id,
        { kind: fixture },
        "New example submission added. Run fresh checks.",
      );
      setMobileTab("submission");
    } catch {
    } finally {
      setBusy("");
    }
  }
  async function handleUpload(file?: File) {
    if (!file) return;
    setBusy("upload");
    try {
      await uploadFile(r.id, file, "Supplier submission");
      setMobileTab("submission");
    } catch {
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }
  async function decide() {
    setBusy("decision");
    try {
      await action(
        "review.decide",
        r.id,
        { decision, note, acknowledge },
        decision === "accepted"
          ? "Submission accepted. Payment still requires a separate review."
          : decision === "correction"
            ? "Correction request recorded in the decision trail."
            : "Question recorded. No message sent.",
      );
      setDecision("");
      setNote("");
    } catch {
    } finally {
      setBusy("");
    }
  }
  if (!a)
    return (
      <section className="panel">
        <Empty
          icon={FileSearch}
          title="Good evidence starts with an agreement"
          description="Select a written quotation and get both parties’ acceptance before reviewing a supplier submission."
        >
          <Link
            href={`/requests/${r.id}?tab=quotes`}
            className="btn btn-primary"
          >
            Compare quotes
            <ArrowRight size={15} />
          </Link>
        </Empty>
      </section>
    );
  return (
    <div className="evidence-workspace">
      <div className="tab-section-heading">
        <div>
          <h2>The details make the difference.</h2>
          <p>
            Compare the approved reference with the actual submission. Every
            check shows its source.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={!a.supplier_accepted}
          busy={busy === "upload"}
          onClick={() => input.current?.click()}
        >
          <Upload size={15} />
          Upload new evidence
        </Button>
        <input
          type="file"
          ref={input}
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="sr-only"
          aria-label="Upload supplier evidence"
          onChange={(e) => void handleUpload(e.target.files?.[0])}
        />
      </div>
      {data.workspace.mode === "sample" && (
        <div className="sample-toolbox">
          <span>
            <Badge tone="blue">Sample documents</Badge>Try a different proof
          </span>
          <div>
            <select
              aria-label="Example artwork to load"
              value={fixture}
              onChange={(e) => setFixture(e.target.value)}
            >
              <option value="correct">Correct submission</option>
              <option value="wrong-phone">Wrong phone number</option>
              <option value="missing-element">Missing required wording</option>
            </select>
            <Button
              variant="secondary"
              busy={busy === "example"}
              onClick={() => void example()}
            >
              Load example
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
      {review?.decision === "accepted" ? (
        <Notice tone="green">
          <strong>Evidence accepted for submission v{latest?.version}.</strong>{" "}
          The current stage is ready for your payment review.{" "}
          <Link href={`/requests/${r.id}?tab=payments`} className="text-link">
            Review payment
            <ArrowRight size={14} />
          </Link>
        </Notice>
      ) : (
        <div
          className={`eligibility-banner ${failed ? "eligibility-blocked" : ""}`}
        >
          <span className="eligibility-icon">
            <ShieldCheck size={21} />
          </span>
          <div>
            <strong>
              {failed
                ? "Payment paused. A requirement doesn’t match."
                : !latest
                  ? "Waiting for supplier evidence."
                  : review
                    ? "Your review is the next step."
                    : "New submission. Fresh checks required."}
            </strong>
            <p>
              {failed
                ? "Correct the failed check before accepting this stage. No payment has been captured."
                : `${unknown ? `${unknown} uncertain or visual ${unknown === 1 ? "check needs" : "checks need"} your review. ` : ""}Funds are only captured after an accepted, current submission and your separate confirmation.`}
            </p>
          </div>
          <Badge tone={failed ? "red" : "amber"}>
            {failed
              ? `${failed} failed ${failed === 1 ? "check" : "checks"}`
              : "Needs your review"}
          </Badge>
        </div>
      )}
      <div className="mobile-review-tabs">
        {["reference", "submission", "checks"].map((t) => (
          <button
            key={t}
            className={mobileTab === t ? "selected" : ""}
            aria-pressed={mobileTab === t}
            onClick={() => setMobileTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className={`evidence-columns evidence-show-${mobileTab}`}>
        <div className="reference-column">
          {references.length > 1 && (
            <Field label="Buyer reference file">
              <select
                value={selectedReference?.id || ""}
                onChange={(event) => setReferenceId(event.target.value)}
              >
                {references.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name} ·{" "}
                    {referenceIds.includes(file.id)
                      ? "Approved reference"
                      : "Private buyer context"}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <DocumentPreview
            key={selectedReference?.id || "empty-reference"}
            asset={reference || privateReference}
            label={
              reference
                ? "Approved reference"
                : privateReference
                  ? "Private buyer reference"
                  : "Approved reference"
            }
            version={
              reference
                ? `Requirements v${r.version}`
                : privateReference
                  ? "Private · not shared"
                  : `Requirements v${r.version}`
            }
          />
          {!reference && (
            <Notice tone="neutral">
              {privateReference
                ? "This chat attachment is private buyer context. It was not included in the supplier’s approved requirements and is not used as an approved reference by document checks."
                : "No reference file was included in the confirmed requirements. Chat attachments stay private; the confirmed text brief remains the basis for review."}
            </Notice>
          )}
          <div className="document-context">
            <span className="section-kicker">EXACT REQUIREMENTS</span>
            <dl>
              <div>
                <dt>Printed text</dt>
                <dd>{r.spec.exactText || "Not specified"}</dd>
              </div>
              <div>
                <dt>Required wording</dt>
                <dd>{r.spec.requiredElement || "Not specified"}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{r.spec.dimensions || "Not specified"}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="submission-column">
          <DocumentPreview
            asset={asset}
            label="Supplier submission"
            version={viewed ? `Submission v${viewed.version}` : "Awaiting file"}
          />
          <div className="submission-versions">
            <span>Submission history</span>
            <select
              value={viewed?.id || ""}
              aria-label="View submission version"
              onChange={(e) => setViewSub(e.target.value)}
            >
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>
                  Version {s.version}
                  {s.id === latest?.id ? " · Current" : ""} ·{" "}
                  {date(s.created_at)}
                </option>
              ))}
            </select>
            <p>
              {viewed?.id !== latest?.id
                ? "Viewing an older file. Checks and decisions apply only to the current submission."
                : asset
                  ? "A new file always needs fresh checks and acceptance."
                  : "Ask the selected supplier to upload artwork through their private link."}
            </p>
          </div>
        </div>
        <section className="checks-column panel">
          <div className="checks-heading">
            <div>
              <span className="section-kicker">REQUIREMENT CHECKS</span>
              <h3>Evidence, in the details.</h3>
            </div>
            <FileSearch size={22} />
          </div>
          <div className="checks-summary">
            <span className="text-green">
              <CheckCircle2 size={14} />
              {findings.filter((f) => f.result === "pass").length} pass
            </span>
            <span className="text-red">
              <XCircle size={14} />
              {failed} fail
            </span>
            <span className="text-amber">
              <CircleHelp size={14} />
              {unknown} review
            </span>
          </div>
          <div className="checks-body">
            {findings.length ? (
              findings.map((f) => (
                <FindingRow
                  key={f.requirementId}
                  finding={f}
                  assetId={latest.asset_id}
                />
              ))
            ) : (
              <div className="checks-empty">
                <FileSearch size={27} strokeWidth={1.4} />
                <h4>
                  {job
                    ? "Checking this document…"
                    : "Let’s check the important details."}
                </h4>
                <p>
                  Fresh PDF text is checked against the confirmed requirements.
                  Images and unreadable documents need visual review.
                </p>
              </div>
            )}
            <Button
              variant="secondary"
              className="full-width"
              disabled={!latest}
              busy={!!job}
              onClick={() =>
                void action(
                  "review.analyze",
                  r.id,
                  undefined,
                  "Document checks queued.",
                ).catch(() => {})
              }
            >
              <FileSearch size={15} />
              {job
                ? "Checking current submission…"
                : review
                  ? "Run fresh checks"
                  : "Run document checks"}
            </Button>
            {failedJob && !job && (
              <div className="job-error">
                <p>{failedJob.error}</p>
                <button
                  className="text-link"
                  onClick={() =>
                    void action(
                      "job.retry",
                      r.id,
                      { jobId: failedJob.id },
                      "Document check requeued.",
                    ).catch(() => {})
                  }
                >
                  Retry check
                </button>
              </div>
            )}
            <p className="checks-method">
              Local deterministic PDF checks. No AI vision assessment. Physical
              quality needs human acceptance.
            </p>
          </div>
          <div className="review-decision">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={acknowledge}
                disabled={!review || failed > 0}
                onChange={(e) => setAcknowledge(e.target.checked)}
              />
              <span>
                I reviewed the actual file, visual requirements and all unknown
                checks.
              </span>
            </label>
            <Button
              className="full-width"
              disabled={
                !review ||
                failed > 0 ||
                !acknowledge ||
                review.decision === "accepted"
              }
              onClick={() => {
                setDecision("accepted");
                setNote("");
              }}
            >
              <Check size={16} />
              Accept this stage
            </Button>
            <div className="review-secondary-actions">
              <button
                disabled={!review}
                onClick={() => {
                  setDecision("correction");
                  setNote(
                    findings
                      .filter((f) => f.result === "fail")
                      .map((f) => f.correction)
                      .join("\n"),
                  );
                }}
              >
                <RotateCcw size={14} />
                Request correction
              </button>
              <button
                disabled={!review}
                onClick={() => {
                  setDecision("question");
                  setNote("");
                }}
              >
                <MessageSquare size={14} />
                Ask a question
              </button>
            </div>
            <span className="review-assurance">
              <ShieldCheck size={12} />
              Acceptance never triggers a payment.
            </span>
          </div>
        </section>
      </div>
      <section className="panel all-files-panel">
        <div className="panel-head">
          <h2>Request files</h2>
          <span className="muted">Originals and every submission version</span>
        </div>
        <div className="compact-file-list">
          {data.assets
            .filter((a) => a.request_id === r.id)
            .map((a) => (
              <a
                key={a.id}
                href={`/api/assets/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={16} />
                <strong>{a.name}</strong>
                <span>{a.role}</span>
                <ArrowUpRight size={14} />
              </a>
            ))}
        </div>
      </section>
      {decision && (
        <Modal
          title={
            decision === "accepted"
              ? "Accept the current stage"
              : decision === "correction"
                ? "Request a correction"
                : "Ask about the evidence"
          }
          onClose={() => setDecision("")}
        >
          <div className="review-confirmation">
            <ShieldCheck size={26} />
            <h3>
              Submission v{latest?.version} · Requirements v{r.version}
            </h3>
            <p>
              {decision === "accepted"
                ? "You are accepting the current evidence, including the visual and uncertain checks you reviewed. PayPal capture still needs a separate financial confirmation."
                : "Your note will be preserved in the request history. Share it with the supplier through your agreed channel; no message is sent automatically."}
            </p>
          </div>
          {decision !== "accepted" && (
            <Field
              label={
                decision === "correction"
                  ? "What needs to change?"
                  : "Your question"
              }
            >
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDecision("")}>
              Go back
            </Button>
            <Button
              busy={busy === "decision"}
              disabled={decision !== "accepted" && !note.trim()}
              onClick={() => void decide()}
            >
              {decision === "accepted"
                ? "Confirm acceptance"
                : "Record decision"}
              <Check size={15} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
