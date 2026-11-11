import { LogOut, MessageCircle } from "lucide-react";
import { getCustomerByEmail, getSession, logout } from "@kumbuild/lib";
import Layout from "../components/Layout";
import { ACCOUNT_URL } from "../lib/urls";
import { formatDate, waLink } from "../lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const session = getSession();
  if (!session) return null;

  const customer = getCustomerByEmail(session.email);

  function handleLogout() {
    logout();
    window.location.href = `${ACCOUNT_URL}/login`;
  }

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 text-muted">
          Your details, as we have them on record.
        </p>

        <section
          aria-label="Your details"
          className="mt-6 rounded-xl border border-line bg-white p-5"
        >
          <dl className="divide-y divide-line">
            <Row label="Name" value={customer?.name ?? session.name} />
            <Row label="Email" value={customer?.email ?? session.email} />
            <Row label="Phone" value={customer?.phone ?? "—"} />
            <Row
              label="Business"
              value={customer?.businessName ?? "—"}
            />
            <Row
              label="Customer since"
              value={
                customer ? formatDate(customer.joinedOn) : "—"
              }
            />
          </dl>
          <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
            To change your details, message us on WhatsApp.
          </p>
          <a
            href={waLink("Hi Kumbuild, I'd like to update my details.")}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-live px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#127032]"
          >
            <MessageCircle className="h-4 w-4" />
            Message us on WhatsApp
          </a>
        </section>

        <section
          aria-label="Account"
          className="mt-4 rounded-xl border border-line bg-white p-5"
        >
          <h2 className="font-display text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted">
            Signed in as {session.email}. Logging out takes you back to the
            login page.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-body hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </section>
      </main>
    </Layout>
  );
}
