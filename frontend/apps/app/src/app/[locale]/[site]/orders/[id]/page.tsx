import OrderDetailPage from "@/sites/home/OrderDetailPage";
import { assertSite } from "@/lib/site";

// home.kumbuild.com/orders/[id] — sirf customer site par.
export default async function OrderDetailRoute({
  params,
}: {
  params: Promise<{ site: string; id: string }>;
}) {
  const { site, id } = await params;
  assertSite(site, "home");
  return <OrderDetailPage params={Promise.resolve({ id })} />;
}
