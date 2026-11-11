import { z } from "zod";
import { all, audit, DomainError, id, insert, now, run } from "../db";
import { getRequest } from "../domain";
import type { Job, Supplier, Workspace } from "../types";

export function queueDiscovery(workspace: Workspace, requestId: string) {
  const r = getRequest(workspace.id, requestId);
  if (workspace.mode !== "sandbox")
    throw new DomainError(
      workspace.mode === "sample"
        ? "Supplier search requires connected sandbox. Sample suppliers are fictional; no search results are invented."
        : "Connect owner sign-in and supplier search in Settings before starting a provider search.",
      503,
    );
  if (!process.env.TAVILY_API_KEY)
    throw new DomainError(
      "Connect supplier search: set TAVILY_API_KEY in the server environment.",
      503,
    );
  if (
    !r.version ||
    !r.spec.discover ||
    !r.spec.region ||
    r.spec.maxContacts < 1
  )
    throw new DomainError(
      "Confirm a search region and a contact limit in your outreach policy first.",
    );
  const active = all<Job>(
    "SELECT * FROM jobs WHERE workspace_id=? AND request_id=? AND kind=? AND status IN (?,?)",
    workspace.id,
    requestId,
    "discovery",
    "queued",
    "running",
  );
  if (active.length) return { id: active[0].id };
  const jid = id();
  insert("jobs", {
    id: jid,
    workspace_id: workspace.id,
    request_id: requestId,
    kind: "discovery",
    payload: "{}",
    status: "queued",
    attempts: 0,
    run_after: now(),
    locked_at: null,
    error: null,
    created_at: now(),
  });
  audit(
    workspace.id,
    requestId,
    "discovery",
    `Supplier search queued. Up to ${r.spec.maxContacts} public candidates; no contacts will be called or emailed.`,
  );
  return { id: jid };
}
export async function executeDiscovery(job: Job) {
  const r = getRequest(job.workspace_id, job.request_id);
  const query = `${r.category} ${r.title} suppliers deliver to ${r.spec.region}`;
  const rid = id();
  insert("discovery_runs", {
    id: rid,
    workspace_id: job.workspace_id,
    request_id: r.id,
    query,
    status: "running",
    created_at: now(),
  });
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(10, r.spec.maxContacts),
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new DomainError(
        `Supplier search returned ${response.status}. Check your Tavily account and key.`,
        502,
      );
    const data = z
      .object({
        results: z.array(
          z.object({ title: z.string(), url: z.url(), content: z.string() }),
        ),
      })
      .parse(await response.json());
    const suppliers = all<Supplier>(
      "SELECT * FROM suppliers WHERE workspace_id=?",
      job.workspace_id,
    );
    let count = 0;
    for (const result of data.results.slice(0, r.spec.maxContacts)) {
      const url = new URL(result.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      url.hash = "";
      if (
        suppliers.some(
          (s) =>
            s.website &&
            new URL(s.website).hostname.replace(/^www\./, "") ===
              url.hostname.replace(/^www\./, ""),
        )
      )
        continue;
      const resultInsert = run(
        "INSERT OR IGNORE INTO candidates (id,workspace_id,request_id,run_id,title,url,evidence,retrieved_at) VALUES (?,?,?,?,?,?,?,?)",
        id(),
        job.workspace_id,
        r.id,
        rid,
        result.title.slice(0, 250),
        url.toString(),
        result.content.slice(0, 8000),
        now(),
      );
      count += resultInsert.changes;
    }
    run("UPDATE discovery_runs SET status=? WHERE id=?", "completed", rid);
    audit(
      job.workspace_id,
      r.id,
      "discovery",
      `Search completed: ${count} new public source records. Contact details and delivery coverage still need review.`,
    );
  } catch (e) {
    run("UPDATE discovery_runs SET status=? WHERE id=?", "failed", rid);
    throw e;
  }
}
