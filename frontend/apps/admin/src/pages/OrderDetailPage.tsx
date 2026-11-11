import { Link, useParams } from "react-router-dom";
import { getOrder, payments } from "@kumbuild/lib";
import { formatDate, inr } from "../lib/format";
import { useLocale } from "../lib/i18n";
import { Card, PageTitle, StatusBadge } from "../components/ui";

// Admin order detail — admin.kumbuild.com/orders/:id.
// NEW page (Next.js app me detail page nahi tha). Mock data: getOrder(id)
// + us order ke related payments. Status change backend aane pe aayega.
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLocale();
  const order = id ? getOrder(id) : undefined;

  if (!order) {
    return (
      <div>
        <PageTitle title="Order not found" subtitle={`Koi order "${id ?? ""}" id se nahi mila.`} />
        <Link to="/orders" className="font-semibold text-primary-text">
          ← All orders dekho
        </Link>
      </div>
    );
  }

  const relatedPayments = payments.filter((p) => p.orderId === order.id);
  const balanceDue = order.price - order.advancePaid;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title={`${order.businessName} · ${order.id}`}
          subtitle={`${order.customerName} · Ordered ${formatDate(order.orderedOn, locale)}`}
        />
        <StatusBadge status={order.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Order</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Business type</dt>
              <dd className="font-semibold">{order.businessType}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Package</dt>
              <dd className="font-semibold">{order.packageName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Price</dt>
              <dd className="font-semibold">{inr(order.price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Advance paid</dt>
              <dd className="font-semibold">{inr(order.advancePaid)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Balance due</dt>
              <dd className="font-semibold">{inr(balanceDue)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Revisions used</dt>
              <dd className="font-semibold">{order.revisionsUsed} of 2 free</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Ordered on</dt>
              <dd className="font-semibold">{formatDate(order.orderedOn, locale)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Customer</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold">{order.customerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="font-semibold">{order.customerEmail}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Phone / WhatsApp</dt>
              <dd className="font-semibold">{order.customerPhone}</dd>
            </div>
          </dl>

          <h2 className="mt-6 text-lg font-bold">Links</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Preview URL</dt>
              <dd className="font-semibold">
                {order.previewUrl ? (
                  <a href={order.previewUrl} target="_blank" rel="noreferrer" className="text-primary-text hover:underline">
                    {order.previewUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Live URL</dt>
              <dd className="font-semibold">
                {order.liveUrl ? (
                  <a href={order.liveUrl} target="_blank" rel="noreferrer" className="text-live hover:underline">
                    {order.liveUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Renewal date</dt>
              <dd className="font-semibold">
                {order.renewalDate ? formatDate(order.renewalDate, locale) : "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-lg font-bold">Notes</h2>
        <p className="mt-2 text-sm text-body">{order.notes || "—"}</p>
      </Card>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Payments for this order</h2>
        {relatedPayments.length === 0 ? (
          <p className="text-sm text-muted">Is order ke liye koi payment nahi hai.</p>
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedPayments.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-semibold">{p.id}</td>
                      <td className="px-4 py-3">{p.kind}</td>
                      <td className="px-4 py-3">{p.method}</td>
                      <td className="px-4 py-3">{inr(p.amount)}</td>
                      <td className="px-4 py-3">{p.date ? formatDate(p.date, locale) : "—"}</td>
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
        )}
      </div>

      <p className="mt-6 text-sm text-muted">
        Status change aur customer message backend aane pe yahan honge.{" "}
        <Link to="/orders" className="font-semibold text-primary-text">
          ← All orders dekho
        </Link>
      </p>
    </div>
  );
}
