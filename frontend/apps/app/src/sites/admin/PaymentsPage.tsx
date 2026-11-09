"use client";

import { useLocale } from "next-intl";
import { payments } from "@/lib/mock";
import { formatDate, inr } from "@/lib/format";
import { Card, PageTitle } from "@/components/ui";

// Admin payments — admin.kumbuild.com/payments.
// Saare payments, advance / final / renewal (mock).
// locale context se aata hai (useLocale) — getLocale() static export me
// next-intl ka headers() fallback padhta hai, isliye use nahi karte.
export default function AdminPaymentsPage() {
  const locale = useLocale();  const paid = payments
    .filter((p) => p.status === "Paid")
    .reduce((s, p) => s + p.amount, 0);
  const pending = payments
    .filter((p) => p.status === "Pending")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageTitle
        title="Payments"
        subtitle="Saare payments — advance, final, renewal (Razorpay, mock data)."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-muted">Received</p>
          <p className="mt-1 text-3xl font-bold text-success">{inr(paid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Pending</p>
          <p className="mt-1 text-3xl font-bold text-warning">{inr(pending)}</p>
        </Card>
      </div>

      <Card className="mt-6 p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-semibold">{p.id}</td>
                  <td className="px-4 py-3">{p.orderId}</td>
                  <td className="px-4 py-3">{p.businessName}</td>
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
      </Card>
    </div>
  );
}
