import { Link } from "react-router-dom";
import { ArrowRight, Wallet } from "lucide-react";
import {
  getCustomerByEmail,
  getCustomerOrders,
  getSession,
  type Order,
} from "@kumbuild/lib";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import { WEB_URL } from "../lib/urls";
import {
  balanceDue,
  formatDate,
  formatINR,
  NEXT_STEP,
  pendingPaymentsFor,
  waLink,
} from "../lib/format";

function OrderCard({ order }: { order: Order }) {
  const due = balanceDue(order);
  const next =
    order.status === "live" && order.renewalDate
      ? `${NEXT_STEP.live} Renewal due ${formatDate(order.renewalDate)}.`
      : NEXT_STEP[order.status];
  return (
    <article className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/orders/${order.id}`}
            className="font-display text-lg font-semibold text-ink hover:text-primary-700 hover:underline"
          >
            {order.businessName}
          </Link>
          <p className="mt-0.5 text-sm text-muted">
            {order.businessType} · {order.packageName} package · Ordered{" "}
            {formatDate(order.orderedOn)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted">Price:</dt>
          <dd className="font-medium text-ink">{formatINR(order.price)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Advance paid:</dt>
          <dd className="font-medium text-ink">
            {formatINR(order.advancePaid)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Balance due:</dt>
          <dd
            className={`font-medium ${due > 0 ? "text-ink" : "text-live"}`}
          >
            {due > 0 ? formatINR(due) : "Paid in full"}
          </dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-line pt-3 text-sm text-body">
        {next}
      </p>

      <div className="mt-3">
        <Link
          to={`/orders/${order.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
        >
          View details
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const session = getSession();
  if (!session) return null;

  const customer = getCustomerByEmail(session.email);
  const orders = getCustomerOrders(session.email);
  const orderIds = orders.map((o) => o.id);
  const pending = pendingPaymentsFor(orderIds);
  const totalDue = orders.reduce((sum, o) => sum + balanceDue(o), 0);
  const businessName =
    customer?.businessName ?? orders[0]?.businessName ?? null;

  return (
    <Layout>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          Hi, {session.name}
        </h1>
        <p className="mt-1 text-muted">
          {businessName
            ? `${businessName} — here's where your website stands.`
            : "Here's where your website stands."}
        </p>

        {orders.length === 0 ? (
          <section className="mt-8 rounded-xl border border-line bg-card p-8 text-center">
            <h2 className="font-display text-xl font-semibold">
              You don&apos;t have any orders yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Once you order a website, you&apos;ll be able to track its
              progress, see your preview and manage payments here.
            </p>
            <a
              href={`${WEB_URL}/order`}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cta px-5 py-3 text-sm font-semibold text-white hover:bg-cta-hover"
            >
              Order my website
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        ) : (
          <>
            <section
              aria-label="Summary"
              className="mt-6 grid grid-cols-3 gap-3"
            >
              <div className="rounded-xl border border-line bg-card p-4">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  Orders
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                  {orders.length}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card p-4">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  In progress
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                  {
                    orders.filter(
                      (o) => o.status !== "live" && o.status !== "approved",
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card p-4">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  Balance due
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                  {totalDue > 0 ? formatINR(totalDue) : "₹0"}
                </p>
              </div>
            </section>

            <section aria-label="My orders" className="mt-6 grid gap-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </section>

            <section
              aria-label="Payments pending"
              className="mt-8 rounded-xl border border-line bg-card p-5"
            >
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Wallet className="h-5 w-5 text-primary-600" />
                Payments pending
              </h2>
              {pending.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No payments pending right now. The final payment is raised
                  once your website is approved.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {pending.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {p.kind} — {p.businessName}
                        </p>
                        <p className="text-xs text-muted">
                          Order {p.orderId}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {formatINR(p.amount)}
                        </span>
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                          Pending
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {pending.length > 0 && (
                <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
                  To complete a pending payment,{" "}
                  <a
                    href={waLink(
                      "Hi Kumbuild, I'd like to complete a pending payment.",
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-700 hover:underline"
                  >
                    message us on WhatsApp
                  </a>
                  .
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </Layout>
  );
}
