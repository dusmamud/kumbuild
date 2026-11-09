import { customers, orders, payments } from "@/lib/mock";
import { inr } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Card, PageTitle, StatusBadge } from "@/components/ui";

// Admin dashboard — admin.kumbuild.com/ (SUBDOMAINS.md Section 4).
// Aaj ke orders, pending kaam, revenue summary (mock).
export default function AdminDashboardPage() {
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

      <div className="grid gap-4 sm:grid-cols-4">
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
          <Link href="/orders" className="text-sm font-semibold text-primary-text">
            Saare orders →
          </Link>
        </div>
        <div className="space-y-3">
          {pending.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {o.businessName} · {o.id}
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
