import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getOrder, ORDER_STATUSES, ORDER_STATUS_LABEL } from "@/lib/mock";
import { formatDate, inr } from "@/lib/format";
import { Card, PageTitle, StatusBadge } from "@/components/ui";

// Order detail — home.kumbuild.com/orders/[id].
// Package, status timeline, preview link, revisions, payment summary.
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) notFound();
  const locale = await getLocale();

  const currentStep = ORDER_STATUSES.indexOf(order.status);
  const balance = order.price - order.advancePaid;

  return (
    <div>
      <PageTitle
        title={`${order.businessName} — ${order.id}`}
        subtitle={`${order.packageName} package · ordered ${formatDate(order.orderedOn, locale)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="text-lg font-bold">Status</h2>
            <div className="mt-3">
              <StatusBadge status={order.status} />
            </div>
            <ol className="mt-4 space-y-2">
              {ORDER_STATUSES.map((s, i) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      i <= currentStep
                        ? "bg-primary-500 text-on-primary"
                        : "bg-surface-hover text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={i === currentStep ? "font-semibold text-ink" : "text-muted"}>
                    {ORDER_STATUS_LABEL[s]}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Business type</dt>
                <dd className="font-medium">{order.businessType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Revisions used</dt>
                <dd className="font-medium">{order.revisionsUsed} / 2 free</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Preview</dt>
                <dd className="font-medium">
                  {order.previewUrl ? (
                    <a href={order.previewUrl} target="_blank" rel="noreferrer" className="text-primary-text">
                      Preview kholo →
                    </a>
                  ) : (
                    "Abhi nahi bana"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Live website</dt>
                <dd className="font-medium">
                  {order.liveUrl ? (
                    <a href={order.liveUrl} target="_blank" rel="noreferrer" className="text-primary-text">
                      {order.liveUrl}
                    </a>
                  ) : (
                    "Abhi live nahi hai"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Renewal</dt>
                <dd className="font-medium">
                  {order.renewalDate ? `${order.renewalDate} (${inr(1999)}/year)` : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg bg-surface-hover p-3 text-sm text-muted">
              {order.notes}
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Payment</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Package price</dt>
                <dd className="font-medium">{inr(order.price)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Advance paid</dt>
                <dd className="font-medium text-success">{inr(order.advancePaid)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <dt className="text-muted">Balance</dt>
                <dd className="font-bold">{balance > 0 ? inr(balance) : "Paid in full"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Balance approval ke baad, go-live se pehle pay karna hai
              (Razorpay — UPI / card / netbanking).
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Support</h2>
            <p className="mt-2 text-sm text-muted">
              Preview par feedback ya revision chahiye to support par message
              karo.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
