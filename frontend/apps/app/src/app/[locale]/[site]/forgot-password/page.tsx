import ForgotPasswordPage from "@/sites/auth/ForgotPasswordPage";
import { assertSite } from "@/lib/site";

// auth.kumbuild.com/forgot-password
export default async function ForgotPasswordRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "auth");
  return <ForgotPasswordPage />;
}
