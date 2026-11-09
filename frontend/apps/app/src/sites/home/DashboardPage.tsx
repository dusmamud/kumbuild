import { getSession } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/mock";
import { inr } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Card, PageTitle, StatusBadge } from "@/components/ui";

// Customer dashboard — home.kumbuild.com/ (SUBDOMAINS.md Section 3).
// Mere orders ka summary, current website ka status, aage kya karna hai.
export default async function HomeDashboardPage() {
  const session = await getSession();
  const myOrders = session ? getCustomerOrders(session.email) : [];

  const live = myOrders.find((o) => o.status === "live");
  const active = myOrders.filter((o) => o.status !== "live");

  return (
    <div>
      <PageTitle
        title={`Namaste, ${session?.name ?? "Customer"} 👋`}
        subtitle="Tumhare orders aur website ka status yahan dikhega."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Total orders</p>
          <p className="mt-1 text-3xl font-bold">{myOrders.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Kaam chal raha hai</p>
          <p className="mt-1 text-3xl font-bold">{active.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Live websites</p>
          <p className="mt-1 text-3xl font-bold">
            {myOrders.filter((o) => o.status === "live").length}
          </p>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Meri website</h2>
          {live ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>
                <span className="font-semibold">{live.businessName}</span> —{" "}
                <a
                  href={live.liveUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary-text"
                >
                  {live.liveUrl}
                </a>
              </p>
              <p className="text-muted">
                Renewal: {live.renewalDate} ({inr(1999)}/year)
              </p>
              <Link href="/my-website" className="mt-2 inline-block font-semibold text-primary-text">
                Details dekho →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Abhi koi website live nahi hai. Jab order complete hoga, yahan
              link aa jayega.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Aage kya karna hai</h2>
          {active.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {active.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    {o.businessName} — {o.packageName} ({inr(o.price)})
                  </span>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Koi active order nahi hai. Nayi website order karni ho to{" "}
              <a
                href="https://kumbuild.com/order"
                className="font-semibold text-primary-text"
              >
                kumbuild.com/order
              </a>{" "}
              par jao.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent orders</h2>
          <Link href="/orders" className="text-sm font-semibold text-primary-text">
            Saare orders →
          </Link>
        </div>
        {myOrders.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Is account se koi order nahi mila (mock data). Demo customer se
              login karo to orders dikhenge.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {myOrders.map((o) => (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {o.businessName} · {o.id}
                  </p>
                  <p className="text-sm text-muted">
                    {o.packageName} — {inr(o.price)} · Advance paid {inr(o.advancePaid)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  <Link
                    href={`/orders/${o.id}`}
                    className="text-sm font-semibold text-primary-text"
                  >
                    Details →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
