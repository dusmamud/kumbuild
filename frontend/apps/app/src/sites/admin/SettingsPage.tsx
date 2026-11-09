import { getSession } from "@/lib/auth";
import { buttonPrimaryClass, Card, Field, inputClass, PageTitle } from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";

// Admin settings — admin.kumbuild.com/settings.
// Admin profile aur settings (mock).
export default async function AdminSettingsPage() {
  const session = await getSession();

  return (
    <div>
      <PageTitle title="Admin settings" subtitle="Admin profile aur preferences." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Profile</h2>
          <form className="mt-4 space-y-4">
            <Field label="Name">
              <input
                type="text"
                defaultValue={session?.name ?? "Dus Mamud"}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                defaultValue={session?.email ?? ""}
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
            <h2 className="text-lg font-bold">Theme</h2>
            <p className="mt-1 text-sm text-muted">
              System (device setting), Light ya Dark — choice save hoti hai.
            </p>
            <div className="mt-3">
              <ThemeToggle />
            </div>
          </Card>
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
