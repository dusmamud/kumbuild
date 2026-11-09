import NewOrderPage from "@/sites/admin/NewOrderPage";
import { assertSite } from "@/lib/site";

// admin.kumbuild.com/orders/new — confirm hua order add karo.
export default async function NewOrderRoute({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ error?: string; success?: string; package?: string }>;
}) {
  const { site } = await params;
  assertSite(site, "admin");
  return <NewOrderPage searchParams={searchParams} />;
}
