import { Link } from "react-router-dom";
import { customers, orders, payments } from "@kumbuild/lib";
import { inr } from "../lib/format";
import { Card, PageTitle, StatusBadge } from "../components/ui";

// Admin dashboard — admin.kumbuild.com/ (SUBDOMAINS.md Section 4).
// Aaj ke orders, pending kaam, revenue summary (mock).
// Ported from the Next.js app's sites/admin/DashboardPage.tsx.
export default function DashboardPage() {
  const pending = orders.filter(
    (o) => o.status !== "live" && o.status !== "approved",
  );
  const revenue = payments
    .filter((p) => p.status === "Paid")
    .reduce((s, p) => s + p.amount, 0);
  const due = payments
    .filter((p) => p.status === "Pending")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageTitle
        title="Admin dashboard"
        subtitle="Aaj ke orders, pending kaam aur revenue — mock data."
      />

      {/* 2 cols at sm–lg: at 640–700 the 4-col row squeezed the revenue
          value ("₹32,999" at text-3xl is 112px wide in a 100px content
          box — 14px past its own box at 640). 4 cols again at lg+, where
          each card has ~196px of content width. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Total orders</p>
          <p className="mt-1 text-3xl font-bold">{orders.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Pending kaam</p>
          <p className="mt-1 text-3xl font-bold text-warning">{pending.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Customers</p>
          <p className="mt-1 text-3xl font-bold">{customers.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Revenue (paid)</p>
          <p className="mt-1 text-3xl font-bold text-success">{inr(revenue)}</p>
          <p className="text-xs text-muted">Pending: {inr(due)}</p>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Pending orders</h2>
          <Link to="/orders" className="text-sm font-semibold text-primary-text">
            Saare orders →
          </Link>
        </div>
        <div className="space-y-3">
          {pending.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  <Link to={`/orders/${o.id}`} className="hover:text-primary-text">
                    {o.businessName} · {o.id}
                  </Link>
                </p>
                <p className="text-sm text-muted">
                  {o.customerName} · {o.packageName} · {inr(o.price)}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
