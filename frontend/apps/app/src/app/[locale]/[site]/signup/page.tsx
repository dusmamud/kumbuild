import SignupPage from "@/sites/auth/SignupPage";
import { assertSite } from "@/lib/site";

// auth.kumbuild.com/signup
export default async function SignupRoute({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { site } = await params;
  assertSite(site, "auth");
  return <SignupPage searchParams={searchParams} />;
}
