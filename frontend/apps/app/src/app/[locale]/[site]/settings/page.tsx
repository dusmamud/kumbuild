import { notFound } from "next/navigation";
import AdminSettingsPage from "@/sites/admin/SettingsPage";
import HomeSettingsPage from "@/sites/home/SettingsPage";
import { isSite } from "@/lib/site";

// Settings — home: profile; admin: admin profile.
export default async function SettingsRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  if (!isSite(site)) notFound();
  if (site === "admin") return <AdminSettingsPage />;
  if (site === "home") return <HomeSettingsPage />;
  notFound();
}
