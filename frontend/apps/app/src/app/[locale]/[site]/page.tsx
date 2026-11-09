import { notFound, redirect } from "next/navigation";
import AdminDashboardPage from "@/sites/admin/DashboardPage";
import { isSite } from "@/lib/site";

// Site root — auth: /login par; admin: admin dashboard.
export default async function SiteRootPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  if (!isSite(site)) notFound();
  if (site === "auth") redirect("/login");
  return <AdminDashboardPage />;
}
