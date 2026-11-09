"use client";

import { useLocale } from "next-intl";
import { orders } from "@/lib/mock";
import { formatDate, inr } from "@/lib/format";
import { Card, PageTitle, StatusBadge, buttonPrimaryClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";

// Admin orders — admin.kumbuild.com/orders.
// Har order, status ke saath (mock — status change backend aane pe aayega).
// locale context se aata hai (useLocale) — getLocale() static export me
// next-intl ka headers() fallback padhta hai, isliye use nahi karte.
// NOTE: client component hai — next-intl ka Link server component me
// static export ke time headers() padhta hai (getServerLocale).
export default function AdminOrdersPage() {
  const locale = useLocale();
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title="All orders"
          subtitle="Har order — status change aur customer message backend aane pe."
        />
        <Link href="/orders/new" className={buttonPrimaryClass}>
          + Add order
        </Link>
      </div>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Package</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Ordered</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-semibold">{o.id}</td>
                  <td className="px-4 py-3">{o.businessName}</td>
                  <td className="px-4 py-3">{o.customerName}</td>
                  <td className="px-4 py-3">{o.packageName}</td>
                  <td className="px-4 py-3">{inr(o.price)}</td>
                  <td className="px-4 py-3">{formatDate(o.orderedOn, locale)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
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
