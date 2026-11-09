import { notFound, redirect } from "next/navigation";
import AdminDashboardPage from "@/sites/admin/DashboardPage";
import HomeDashboardPage from "@/sites/home/DashboardPage";
import { isSite } from "@/lib/site";

// Site root — auth: /login par; home: customer dashboard; admin: admin dashboard.
export default async function SiteRootPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  if (!isSite(site)) notFound();
  if (site === "auth") redirect("/login");
  if (site === "admin") return <AdminDashboardPage />;
  return <HomeDashboardPage />;
}
