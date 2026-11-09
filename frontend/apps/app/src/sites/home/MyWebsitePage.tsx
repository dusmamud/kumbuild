import { getSession } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/mock";
import { inr } from "@/lib/format";
import { Card, PageTitle, StatusBadge } from "@/components/ui";

// Meri website — home.kumbuild.com/my-website.
// Live / preview link, details, renewal date.
export default async function MyWebsitePage() {
  const session = await getSession();
  const myOrders = session ? getCustomerOrders(session.email) : [];
  const live = myOrders.find((o) => o.status === "live");
  const preview = myOrders.find((o) => o.previewUrl && o.status !== "live");

  return (
    <div>
      <PageTitle
        title="My website"
        subtitle="Tumhari live ya preview website ka link aur details."
      />
      {live ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{live.businessName}</h2>
                <p className="text-sm text-muted">
                  {live.packageName} package · {live.id}
                </p>
              </div>
              <StatusBadge status="live" />
            </div>
            <p className="mt-4 text-sm">
              Live URL:{" "}
              <a
                href={live.liveUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary-text"
              >
                {live.liveUrl}
              </a>
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Renewal date</dt>
                <dd className="font-medium">{live.renewalDate}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Renewal price</dt>
                <dd className="font-medium">{inr(1999)} / year</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Includes</dt>
                <dd className="text-right font-medium">
                  Domain + hosting + small updates + support
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            Abhi koi website live nahi hai.
            {preview ? (
              <>
                {" "}Preview ready hai:{" "}
                <a
                  href={preview.previewUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary-text"
                >
                  {preview.businessName} ka preview dekho →
                </a>
              </>
            ) : (
              " Order complete hone par yahan link aa jayega."
            )}
          </p>
        </Card>
      )}

      {myOrders.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Saare orders</h2>
          <div className="space-y-3">
            {myOrders.map((o) => (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.businessName}</p>
                  <p className="text-sm text-muted">
                    {o.packageName} · {o.id}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
