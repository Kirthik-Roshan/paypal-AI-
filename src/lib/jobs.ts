import { audit, db, now, one, run } from "./db";
import { reconcilePayment } from "./providers/paypal";
import { executeDiscovery } from "./providers/search";
import { analyzeSubmission } from "./review";
import type { Job, Workspace } from "./types";

export async function workOnce() {
  const job = db().transaction(() => {
    run(
      "UPDATE jobs SET status='queued',locked_at=NULL WHERE status='running' AND locked_at < ? AND kind IN ('analysis','discovery','payment-reconcile')",
      new Date(Date.now() - 120000).toISOString(),
    );
    const j = one<Job>(
      "SELECT * FROM jobs WHERE status='queued' AND run_after<=? ORDER BY created_at LIMIT 1",
      now(),
    );
    if (j)
      run(
        "UPDATE jobs SET status='running',attempts=attempts+1,locked_at=? WHERE id=?",
        now(),
        j.id,
      );
    return j;
  })();
  if (!job) return false;
  try {
    if (job.kind === "analysis")
      await analyzeSubmission(
        one<Workspace>(
          "SELECT * FROM workspaces WHERE id=?",
          job.workspace_id,
        )!,
        job.request_id,
      );
    else if (job.kind === "discovery") await executeDiscovery(job);
    else if (job.kind === "payment-reconcile")
      await reconcilePayment(
        one<Workspace>(
          "SELECT * FROM workspaces WHERE id=?",
          job.workspace_id,
        )!,
        job.request_id,
      );
    else throw Error("Unknown job type");
    run("UPDATE jobs SET status='completed',locked_at=NULL WHERE id=?", job.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Provider request failed.";
    run(
      "UPDATE jobs SET status=?,error=?,locked_at=NULL,run_after=? WHERE id=?",
      job.kind === "payment-reconcile" && job.attempts < 5
        ? "queued"
        : "failed",
      message.slice(0, 500),
      new Date(
        Date.now() + Math.min(60000, 2 ** job.attempts * 3000),
      ).toISOString(),
      job.id,
    );
    audit(
      job.workspace_id,
      job.request_id,
      "error",
      `Background task needs attention: ${message.slice(0, 300)}`,
    );
  }
  return true;
}
