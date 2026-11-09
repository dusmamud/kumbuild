import { getSession } from "@/lib/auth";
import { getCustomerOrders, payments } from "@/lib/mock";
import { formatDate, inr } from "@/lib/format";
import { getLocale } from "next-intl/server";
import { Card, PageTitle } from "@/components/ui";

// Payments — home.kumbuild.com/payments.
// Kitna pay kiya, kitna baaki hai, receipts (mock).
export default async function MyPaymentsPage() {
  const session = await getSession();
  const locale = await getLocale();
  const myOrders = session ? getCustomerOrders(session.email) : [];
  const myIds = new Set(myOrders.map((o) => o.id));
  const myPayments = payments.filter((p) => myIds.has(p.orderId));

  const paid = myPayments
    .filter((p) => p.status === "Paid")
    .reduce((s, p) => s + p.amount, 0);
  const pending = myPayments
    .filter((p) => p.status === "Pending")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageTitle
        title="Payments"
        subtitle="Advance, final payment aur renewal — Razorpay se (mock data)."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-muted">Total paid</p>
          <p className="mt-1 text-3xl font-bold text-success">{inr(paid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Pending</p>
          <p className="mt-1 text-3xl font-bold text-warning">{inr(pending)}</p>
        </Card>
      </div>

      {myPayments.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-muted">
            Is account ke koi payments nahi mile (mock data). Demo customer se
            login karo to payments dikhenge.
          </p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {myPayments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-semibold">{p.id}</td>
                  <td className="px-4 py-3">{p.orderId}</td>
                  <td className="px-4 py-3">{p.kind}</td>
                  <td className="px-4 py-3">{p.method}</td>
                  <td className="px-4 py-3">{inr(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.date ? formatDate(p.date, locale) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.status === "Paid"
                          ? "bg-success-bg text-success"
                          : "bg-warning-bg text-warning"
                      }`}
                    >
                      {p.status}
                    </span>
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
