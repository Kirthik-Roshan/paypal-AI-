"use client";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWorkspace } from "./context";
import { Logo, Modal } from "./ui";
import { PayPalBrand } from "./paypal-brand";
const nav = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/requests", label: "Requests", icon: ClipboardList },
  { path: "/suppliers", label: "Suppliers", icon: Users },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/activity", label: "Activity", icon: Activity },
];
export function Shell({ children }: { children: ReactNode }) {
  const { data } = useWorkspace();
  const initials = data.workspace.name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [bells, setBells] = useState(false),
    [help, setHelp] = useState(false),
    [user, setUser] = useState(false);
  const [mobile, setMobile] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const m = window.matchMedia("(max-width:800px)");
    const update = () => setMobile(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  const input = useRef<HTMLInputElement>(null);
  const req = data.requests.find((r) => pathname === `/requests/${r.id}`);
  const name =
    req?.title ||
    (pathname === "/requests/new"
      ? "New request"
      : pathname === "/settings"
        ? "Settings & integrations"
        : nav.find((n) => n.path === pathname)?.label || "Workspace");
  useEffect(() => {
    setDrawer(false);
    setSearchOpen(false);
  }, [pathname]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const editing =
        e.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
          e.target.isContentEditable);
      if (e.key === "n" && !editing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        router.push("/requests/new");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setDrawer(false);
        setSearchOpen(false);
        setBells(false);
        setUser(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [router]);
  useEffect(() => {
    if (!drawer) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previous = document.activeElement as HTMLElement | null;
    navigation.current
      ?.querySelector<HTMLButtonElement>(".mobile-close")
      ?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        navigation.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      ).filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [drawer]);
  const matches = data.requests
    .filter((r) =>
      `${r.title} ${r.code} ${r.spec.exactText}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 5);
  const attention = data.requests.filter((r) =>
    /review|correction|agreement/i.test(r.status),
  );
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
      )}
      <aside
        ref={navigation}
        inert={mobile && !drawer}
        className={`sidebar ${drawer ? "sidebar-open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand">
          <Link href="/" aria-label="ProcureProof overview">
            <Logo />
          </Link>
          <button
            className="mobile-close icon-btn"
            onClick={() => setDrawer(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <Link href="/settings" className="workspace-switch">
          <span className="workspace-avatar">
            {initials[0]}
            <span />
          </span>
          <span>
            <strong>{data.workspace.name}</strong>
            <small>Business workspace</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <Link href="/requests/new" className="sidebar-new">
          <Plus size={18} />
          New request<kbd>N</kbd>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.path}
              href={n.path}
              className={`nav-item ${(n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)) ? "nav-active" : ""}`}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.label === "Requests" && (
                <span className="nav-count">{data.requests.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/payments" className="sidebar-paypal">
            <PayPalBrand powered />
          </Link>
          <Link
            href="/settings"
            className={`nav-item ${pathname === "/settings" ? "nav-active" : ""}`}
          >
            <Settings2 size={18} />
            Settings & integrations
          </Link>
          <button
            className="nav-item"
            onClick={() => {
              setDrawer(false);
              setHelp(true);
            }}
          >
            <CircleHelp size={18} />
            Help & getting started
            <ArrowUpRight size={13} className="nav-end" />
          </button>
          <div className="sidebar-foot">
            <span className="mini-leaf">◈</span> From conversation to
            confidence.
          </div>
        </div>
      </aside>
      <div className="workspace-main" inert={mobile && drawer}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-icon">
              <LayoutDashboard size={16} />
            </span>
            <Link href="/">Workspace</Link>
            <ChevronRight size={13} />
            <span>{name}</span>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap">
              <Search size={16} />
              <input
                ref={input}
                aria-label="Search workspace requests"
                placeholder="Search anything…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
              <kbd>⌘ K</kbd>
              {searchOpen && (
                <div className="search-results">
                  <div className="dropdown-label">
                    Requests in this workspace
                  </div>
                  {matches.map((r) => (
                    <Link
                      onClick={() => setSearchOpen(false)}
                      href={`/requests/${r.id}`}
                      key={r.id}
                    >
                      <ClipboardList size={16} />
                      <span>
                        {r.title}
                        <small>
                          {r.code} · {r.status}
                        </small>
                      </span>
                      <ChevronRight size={13} />
                    </Link>
                  ))}
                  {!matches.length && (
                    <p>
                      No matching requests. Try a title, request number or
                      printed text.
                    </p>
                  )}
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="dropdown-close"
                  >
                    Close search
                  </button>
                </div>
              )}
            </div>
            <span
              className={`mode-tag ${data.workspace.mode === "sandbox" ? "mode-sandbox" : ""}`}
            >
              <span />
              {data.workspace.mode === "sample"
                ? "Sample walkthrough"
                : data.workspace.mode === "local"
                  ? "Business workspace"
                  : "Connected sandbox"}
            </span>
            <div className="dropdown-wrap">
              <button
                className="icon-btn notification-btn"
                aria-label="Notifications"
                aria-expanded={bells}
                onClick={() => {
                  setBells(!bells);
                  setUser(false);
                }}
              >
                <Bell size={19} />
                {attention.length > 0 && <span />}
              </button>
              {bells && (
                <div className="top-dropdown">
                  <strong>Needs your attention</strong>
                  {attention.length ? (
                    attention.map((r) => (
                      <Link
                        href={`/requests/${r.id}?tab=review`}
                        key={r.id}
                        onClick={() => setBells(false)}
                      >
                        {r.title}
                        <small>{r.status}</small>
                      </Link>
                    ))
                  ) : (
                    <p>You’re all caught up.</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="dropdown-wrap">
              <button
                className="user-avatar"
                aria-label="Workspace menu"
                aria-expanded={user}
                onClick={() => {
                  setUser(!user);
                  setBells(false);
                }}
              >
                {initials}
              </button>
              {user && (
                <div className="top-dropdown">
                  <strong>{data.workspace.name}</strong>
                  <p>
                    {data.workspace.mode === "sample"
                      ? "Fictional sample workspace"
                      : data.workspace.mode === "local"
                        ? "Your business workspace"
                        : "Authenticated owner workspace"}
                  </p>
                  <Link href="/settings" onClick={() => setUser(false)}>
                    Manage integrations
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="page-footer">
          <span>
            ProcureProof <span>·</span> Every detail accounted for.
          </span>
          <span>
            {data.workspace.mode === "sample"
              ? "Sample data · No calls or payments"
              : data.workspace.mode === "local"
                ? "Your business records · Payments require setup"
                : "PayPal sandbox · Test accounts only"}
            <span className="footer-dot" />
          </span>
        </footer>
      </div>
      {help && (
        <Modal
          title="Your first order, with proof"
          onClose={() => setHelp(false)}
        >
          <p className="muted">
            Create a request, collect written quotations, agree a stage and
            review supplier evidence before approving payment.
          </p>
          <ol className="help-steps">
            <li>
              <strong>Start with an agreement</strong>
              <p>
                Describe what your business needs, invite your suppliers and
                compare written offers against your budget and deadline.
              </p>
            </li>
            <li>
              <strong>Find the mismatch</strong>
              <p>
                Open Files & review and check the supplier’s submission against
                your approved requirements.
              </p>
            </li>
            <li>
              <strong>Review a correction</strong>
              <p>
                Ask for a correction when a requirement does not match. Run
                fresh checks on the revised submission before accepting it.
              </p>
            </li>
            <li>
              <strong>Connect your sandbox</strong>
              <p>
                Payments need real PayPal credentials, a mapped test merchant
                and buyer approval. Samples never simulate money.
              </p>
            </li>
          </ol>
          <Link
            className="btn btn-primary"
            href={
              data.requests[0]
                ? `/requests/${data.requests[0]?.id}?tab=review`
                : "/requests/new"
            }
            onClick={() => setHelp(false)}
          >
            Open your request
            <ChevronRight size={16} />
          </Link>
        </Modal>
      )}
    </div>
  );
}
