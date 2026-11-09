import MyWebsitePage from "@/sites/home/MyWebsitePage";
import { assertSite } from "@/lib/site";

// home.kumbuild.com/my-website
export default async function MyWebsiteRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "home");
  return <MyWebsitePage />;
}
