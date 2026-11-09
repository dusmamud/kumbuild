import SupportPage from "@/sites/home/SupportPage";
import { assertSite } from "@/lib/site";

// home.kumbuild.com/support
export default async function SupportRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "home");
  return <SupportPage />;
}
