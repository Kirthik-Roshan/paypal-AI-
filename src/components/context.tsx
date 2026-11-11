"use client";
import type { Integration } from "@/lib/providers/config";
import type { DashboardData } from "@/lib/types";
import { useRouter } from "next/navigation";
import { BusinessSetup } from "./business-setup";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
type Data = DashboardData & { integrations: Integration[] };
type Context = {
  data: Data;
  refresh: () => Promise<void>;
  action: (
    action: string,
    requestId?: string,
    data?: unknown,
    success?: string,
  ) => Promise<any>;
  toast: (message: string, error?: boolean) => void;
  uploadFile: (requestId: string, file: File, role: string) => Promise<void>;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw Error("Workspace not ready");
  return c;
}
export async function jsonFetch(url: string, options?: RequestInit) {
  const r = await fetch(url, options);
  const d = await r.json();
  if (!r.ok)
    throw Object.assign(Error(d.error || "Could not complete this action."), {
      status: r.status,
    });
  return d;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notification, setNotification] = useState<{
      message: string;
      error: boolean;
    } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((message: string, error = false) => {
    setNotification({ message, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotification(null), 6000);
  }, []);
  const refresh = useCallback(async () => {
    const d = await jsonFetch("/api/workspace");
    localStorage.setItem("pp-last-mode", d.workspace.mode);
    setData(d);
  }, []);
  const init = useCallback(async () => {
    setError("");
    try {
      try {
        const d = await jsonFetch("/api/workspace");
        if (
          d.workspace.mode === "sample" &&
          localStorage.getItem("pp-demo-opt-in") !== "true"
        ) {
          setNeedsSetup(true);
          return;
        }
        setData(d);
      } catch (e) {
        if (
          (e as { status?: number }).status !== 401 ||
          localStorage.getItem("pp-last-mode") === "sandbox"
        )
          throw e;
        setNeedsSetup(true);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void init();
    }
  }, [init]);
  useEffect(() => {
    if (!data?.jobs.some((j) => ["queued", "running"].includes(j.status)))
      return;
    const t = setInterval(() => {
      void refresh();
    }, 1500);
    return () => clearInterval(t);
  }, [data?.jobs, refresh]);
  const action = useCallback(
    async (
      action: string,
      requestId?: string,
      body?: unknown,
      success?: string,
    ) => {
      try {
        const result = await jsonFetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, requestId, data: body }),
        });
        await refresh();
        if (success) toast(success);
        return result;
      } catch (e) {
        toast((e as Error).message, true);
        throw e;
      }
    },
    [refresh, toast],
  );
  const uploadFile = useCallback(
    async (requestId: string, file: File, role: string) => {
      const form = new FormData();
      form.set("requestId", requestId);
      form.set("role", role);
      form.set("file", file);
      try {
        await jsonFetch("/api/upload", { method: "POST", body: form });
        await refresh();
        toast("File uploaded securely.");
      } catch (e) {
        toast((e as Error).message, true);
        throw e;
      }
    },
    [refresh, toast],
  );
  if (error)
    return (
      <div className="boot-error">
        <AlertCircle size={30} />
        <h1>Let’s reconnect your workspace</h1>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => void init()}>
          Try again
        </button>
      </div>
    );
  if (needsSetup && !data)
    return (
      <BusinessSetup
        onOpen={async (mode, business) => {
          await jsonFetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode,
              ...(mode === "local" ? business : {}),
            }),
          });
          localStorage.setItem(
            "pp-demo-opt-in",
            mode === "sample" ? "true" : "false",
          );
          await refresh();
          setNeedsSetup(false);
          router.replace("/");
        }}
      />
    );
  if (!data)
    return (
      <div className="boot">
        <span className="brand boot-brand">ProcureProof</span>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
        <span className="boot-label">
          <LoaderCircle size={16} className="spin" />
          Opening your workspace…
        </span>
      </div>
    );
  return (
    <WorkspaceContext.Provider
      value={{ data, refresh, action, toast, uploadFile }}
    >
      {children}
      {notification && (
        <div
          className={`toast ${notification.error ? "toast-error" : ""}`}
          role={notification.error ? "alert" : "status"}
        >
          {notification.error ? (
            <AlertCircle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{notification.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotification(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
