import AdminSettingsPage from "@/sites/admin/SettingsPage";
import { assertSite } from "@/lib/site";

// Settings — admin: admin profile.
export default async function SettingsRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "admin");
  return <AdminSettingsPage />;
}
