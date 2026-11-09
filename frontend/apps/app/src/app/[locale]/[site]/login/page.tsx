import LoginPage from "@/sites/auth/LoginPage";
import { assertSite } from "@/lib/site";

// auth.kumbuild.com/login
export default async function LoginRoute({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { site } = await params;
  assertSite(site, "auth");
  return <LoginPage searchParams={searchParams} />;
}
