import BuildsPage from "@/sites/admin/BuildsPage";
import { assertSite } from "@/lib/site";

// admin.kumbuild.com/builds
export default async function BuildsRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "admin");
  return <BuildsPage />;
}
