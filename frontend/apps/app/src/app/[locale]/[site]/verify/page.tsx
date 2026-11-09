import VerifyPage from "@/sites/auth/VerifyPage";
import { assertSite } from "@/lib/site";

// auth.kumbuild.com/verify
export default async function VerifyRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "auth");
  return <VerifyPage />;
}
