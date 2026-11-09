import { orders, ORDER_STATUSES, ORDER_STATUS_LABEL } from "@/lib/mock";
import { Card, PageTitle, StatusBadge } from "@/components/ui";

// Admin builds — admin.kumbuild.com/builds.
// Kaunsi website kis stage pe hai (mock).
export default function AdminBuildsPage() {
  return (
    <div>
      <PageTitle
        title="Builds"
        subtitle="Kaunsi website kis stage pe hai — build / preview / live."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {ORDER_STATUSES.map((status) => {
          const list = orders.filter((o) => o.status === status);
          return (
            <Card key={status}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{ORDER_STATUS_LABEL[status]}</h2>
                <span className="text-sm font-semibold text-muted">
                  {list.length}
                </span>
              </div>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Koi website is stage pe nahi hai.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {list.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="font-semibold">{o.businessName}</span>
                        <span className="text-muted"> · {o.id} · {o.packageName}</span>
                      </span>
                      <StatusBadge status={o.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
