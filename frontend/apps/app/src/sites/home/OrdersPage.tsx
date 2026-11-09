import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/mock";
import { formatDate, inr } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Card, PageTitle, StatusBadge } from "@/components/ui";

// Mere orders — home.kumbuild.com/orders.
export default async function MyOrdersPage() {
  const session = await getSession();
  const locale = await getLocale();
  const myOrders = session ? getCustomerOrders(session.email) : [];

  return (
    <div>
      <PageTitle
        title="My orders"
        subtitle="Tumhare saare website orders, status ke saath."
      />
      {myOrders.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Is account se koi order nahi mila (mock data). Demo customer se
            login karo — <strong>customer@example.com</strong> — to orders
            dikhenge.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Package</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Ordered</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {myOrders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-semibold">{o.id}</td>
                  <td className="px-4 py-3">{o.businessName}</td>
                  <td className="px-4 py-3">{o.packageName}</td>
                  <td className="px-4 py-3">{inr(o.price)}</td>
                  <td className="px-4 py-3">{formatDate(o.orderedOn, locale)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-semibold text-primary-text"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
