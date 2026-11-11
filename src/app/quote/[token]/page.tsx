import { SupplierPortal } from "@/components/portal";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <SupplierPortal token={(await params).token} />;
}
