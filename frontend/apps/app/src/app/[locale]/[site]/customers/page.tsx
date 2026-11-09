import CustomersPage from "@/sites/admin/CustomersPage";
import { assertSite } from "@/lib/site";

// admin.kumbuild.com/customers
export default async function CustomersRoute({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  assertSite(site, "admin");
  return <CustomersPage />;
}
