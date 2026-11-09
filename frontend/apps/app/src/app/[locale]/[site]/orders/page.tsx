import { notFound } from "next/navigation";
import AdminOrdersPage from "@/sites/admin/OrdersPage";
import HomeOrdersPage from "@/sites/home/OrdersPage";
import { isSite } from "@/lib/site";

// Orders — home: mere orders; admin: saare orders.
export default async function OrdersRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  if (!isSite(site)) notFound();
  if (site === "admin") return <AdminOrdersPage />;
  if (site === "home") return <HomeOrdersPage />;
  notFound();
}
