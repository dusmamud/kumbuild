import { useEffect, useState } from "react";
import { getSession } from "@kumbuild/lib";
import { buttonPrimaryClass, Card, Field, inputClass, PageTitle } from "../components/ui";

// Admin settings — /settings.
// Admin profile aur settings (mock). Session localStorage se aata hai
// (static export) — profile fields usi se prefill hote hain.
// Ported from the Next.js app's sites/admin/SettingsPage.tsx.
// NO ThemeToggle card — light theme only (user dislikes dark UI).
export default function SettingsPage() {
  const [name, setName] = useState("Dus Mamud");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const session = getSession();
    if (session) {
      setName(session.name);
      setEmail(session.email);
    }
  }, []);

  return (
    <div>
      <PageTitle title="Admin settings" subtitle="Admin profile aur preferences." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Profile</h2>
          <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                disabled
                className={`${inputClass} opacity-60`}
              />
            </Field>
            <button type="submit" className={buttonPrimaryClass}>
              Save profile
            </button>
            <p className="text-xs text-muted">
              Mock hai — save karne par kuch store nahi hota.
            </p>
          </form>
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold">Business</h2>
            <p className="mt-1 text-sm text-muted">
              Pricing, packages aur payment settings — backend aane pe yahan
              manage honge. Abhi ye `PRICING.md` / `PAYMENTS.md` docs me hain.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
