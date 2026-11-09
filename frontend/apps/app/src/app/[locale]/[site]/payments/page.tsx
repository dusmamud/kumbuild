import AdminPaymentsPage from "@/sites/admin/PaymentsPage";
import { assertSite } from "@/lib/site";

// Payments — admin: saari payments.
export default async function PaymentsRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "admin");
  return <AdminPaymentsPage />;
}
