"use client";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceProvider } from "./context";
import { RequestConversation } from "./request-conversation";
import { ActivityPage, Overview, PaymentsPage, RequestsPage } from "./overview";
import { RequestDetail } from "./request-detail";
import { SettingsPage } from "./settings";
import { Shell } from "./shell";
import { SuppliersPage } from "./suppliers";
import { Empty } from "./ui";
function Route() {
  const path = usePathname();
  if (path === "/") return <Overview />;
  if (path === "/demo" || path === "/requests/new")
    return <RequestConversation />;
  if (path === "/requests") return <RequestsPage />;
  if (path.startsWith("/requests/"))
    return <RequestDetail requestId={path.split("/")[2]} />;
  if (path === "/suppliers") return <SuppliersPage />;
  if (path === "/payments") return <PaymentsPage />;
  if (path === "/activity") return <ActivityPage />;
  if (path === "/settings") return <SettingsPage />;
  return (
    <Empty
      title="Page not found"
      description="Use the navigation to return to your workspace."
    />
  );
}
export function WorkspaceApp() {
  return (
    <Suspense fallback={<div className="boot">Opening workspace…</div>}>
      <WorkspaceProvider>
        <Shell>
          <Route />
        </Shell>
      </WorkspaceProvider>
    </Suspense>
  );
}
