import AdminOrdersPage from "@/sites/admin/OrdersPage";
import { assertSite } from "@/lib/site";

// Orders — admin: saare orders (admin khud add karta hai).
export default async function OrdersRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "admin");
  return <AdminOrdersPage />;
}
