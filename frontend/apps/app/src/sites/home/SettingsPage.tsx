import { getSession } from "@/lib/auth";
import { buttonPrimaryClass, Card, Field, inputClass, PageTitle } from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";

// Settings — home.kumbuild.com/settings.
// Profile (naam, phone), password change (mock), theme choice.
export default async function HomeSettingsPage() {
  const session = await getSession();

  return (
    <div>
      <PageTitle title="Settings" subtitle="Profile aur preferences." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Profile</h2>
          <form className="mt-4 space-y-4">
            <Field label="Name">
              <input
                type="text"
                defaultValue={session?.name ?? ""}
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
            <Field label="Phone (WhatsApp)">
              <input
                type="tel"
                defaultValue="+91 98765 43210"
                className={inputClass}
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
            <h2 className="text-lg font-bold">Change password</h2>
            <p className="mt-1 text-sm text-muted">
              Mock auth me password kaam nahi karta — backend aane pe yahan
              password change aayega.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
