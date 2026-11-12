import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  MessageCircle,
} from "lucide-react";
import {
  getOrder,
  getSession,
} from "@kumbuild/lib";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import Stepper from "../components/Stepper";
import {
  balanceDue,
  formatDate,
  formatINR,
  paidTotal,
  pendingPaymentsFor,
  waLink,
} from "../lib/format";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = getSession();
  const order = id ? getOrder(id) : undefined;
  const isOwner =
    !!session &&
    !!order &&
    order.customerEmail.toLowerCase() === session.email.toLowerCase();

  if (!order || !isOwner) {
    return (
      <Layout>
        <main className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">
            Order not found
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            This order doesn&apos;t exist, or it belongs to a different
            account.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My orders
          </Link>
        </main>
      </Layout>
    );
  }

  const due = balanceDue(order);
  const paid = paidTotal(order.id);
  const pending = pendingPaymentsFor([order.id]);
  const freeRevisionsLeft = Math.max(0, 2 - order.revisionsUsed);

  return (
    <Layout>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My orders
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              {order.businessName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Order {order.id} · {order.businessType} ·{" "}
              {order.packageName} package · Ordered{" "}
              {formatDate(order.orderedOn)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <section
            aria-label="Order progress"
            className="rounded-xl border border-line bg-card p-5 lg:col-span-3"
          >
            <h2 className="font-display text-lg font-semibold">
              Order progress
            </h2>
            <div className="mt-5">
              <Stepper status={order.status} />
            </div>
          </section>

          <div className="grid gap-4 lg:col-span-2">
            <section
              aria-label="Payment summary"
              className="rounded-xl border border-line bg-card p-5"
            >
              <h2 className="font-display text-lg font-semibold">Payment</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Package price</dt>
                  <dd className="font-medium text-ink">
                    {formatINR(order.price)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Paid so far</dt>
                  <dd className="font-medium text-ink">{formatINR(paid)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-line pt-2">
                  <dt className="text-muted">Balance due</dt>
                  <dd
                    className={`font-semibold ${due > 0 ? "text-ink" : "text-live"}`}
                  >
                    {due > 0 ? formatINR(due) : "Paid in full"}
                  </dd>
                </div>
              </dl>
              {pending.length > 0 && (
                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-body">
                  {pending[0].kind} of {formatINR(pending[0].amount)} is
                  pending — message us on WhatsApp to complete it.
                </p>
              )}
              {order.status === "live" && order.renewalDate && (
                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-body">
                  Renewal due {formatDate(order.renewalDate)} (₹1,999/year).
                </p>
              )}
            </section>

            <section
              aria-label="Links"
              className="rounded-xl border border-line bg-card p-5"
            >
              <h2 className="font-display text-lg font-semibold">
                Your website
              </h2>
              <div className="mt-3 grid gap-2">
                {order.previewUrl && (
                  <a
                    href={order.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-600 px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-tint"
                  >
                    View preview
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {order.liveUrl && (
                  <a
                    href={order.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 dark:hover:bg-primary-500"
                  >
                    Visit live website
                    <Globe className="h-4 w-4" />
                  </a>
                )}
                {!order.previewUrl && !order.liveUrl && (
                  <p className="text-sm text-muted">
                    Your preview link will appear here once it&apos;s ready.
                  </p>
                )}
              </div>
            </section>

            <section
              aria-label="Revisions"
              className="rounded-xl border border-line bg-card p-5"
            >
              <h2 className="font-display text-lg font-semibold">
                Revisions
              </h2>
              <p className="mt-2 text-sm text-body">
                {order.revisionsUsed} of 2 free revisions used
                {freeRevisionsLeft > 0
                  ? ` — ${freeRevisionsLeft} free revision${freeRevisionsLeft === 1 ? "" : "s"} left.`
                  : " — both free revisions used."}
              </p>
            </section>

            {order.notes && (
              <section
                aria-label="Notes from the team"
                className="rounded-xl border border-line bg-card p-5"
              >
                <h2 className="font-display text-lg font-semibold">
                  Notes from the team
                </h2>
                <p className="mt-2 text-sm text-body">{order.notes}</p>
              </section>
            )}

            <a
              href={waLink(
                `Hi Kumbuild, I have a question about my order ${order.id}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-live-strong px-4 py-3 text-sm font-semibold text-white hover:bg-live-strong-hover"
            >
              <MessageCircle className="h-4 w-4" />
              Message us on WhatsApp
            </a>
          </div>
        </div>
      </main>
    </Layout>
  );
}
