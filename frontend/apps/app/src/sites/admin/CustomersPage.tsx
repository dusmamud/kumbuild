import { getLocale } from "next-intl/server";
import { customers } from "@/lib/mock";
import { formatDate } from "@/lib/format";
import { Card, PageTitle } from "@/components/ui";

// Admin customers — admin.kumbuild.com/customers.
// Saare customers, unki websites aur orders (mock).
export default async function AdminCustomersPage() {
  const locale = await getLocale();

  return (
    <div>
      <PageTitle
        title="Customers"
        subtitle="Saare customers — unki websites aur orders."
      />
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Orders</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3">{c.businessName}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.orders}</td>
                  <td className="px-4 py-3">{formatDate(c.joinedOn, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
