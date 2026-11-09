import { getTranslations } from "next-intl/server";
import { loginAction, DEMO_ADMIN_EMAIL, DEMO_CUSTOMER_EMAIL } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buttonGhostClass, buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Login — auth.kumbuild.com/login (SUBDOMAINS.md Section 2).
// MOCK: koi bhi email + koi bhi password chalta hai. Password kahin
// save/store nahi hota — action use discard kar deta hai.
// admin@kumbuild.com -> admin role, baaki sab -> customer role.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("nav");

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("login")}</h1>
      <p className="mt-1 text-sm text-muted">
        Apne Kumbuild account me login karo.
      </p>

      {error === "invalid-email" ? (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Sahi email address likho.
        </p>
      ) : null}

      <form action={loginAction} className="mt-6 space-y-4">
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClass}
          />
        </Field>
        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Login
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs font-semibold text-muted">
          MOCK LOGIN — demo ke liye (koi real password nahi):
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <form action={loginAction}>
            <input type="hidden" name="email" value={DEMO_CUSTOMER_EMAIL} />
            <input type="hidden" name="password" value="demo" />
            <button type="submit" className={buttonGhostClass}>
              Demo customer
            </button>
          </form>
          <form action={loginAction}>
            <input type="hidden" name="email" value={DEMO_ADMIN_EMAIL} />
            <input type="hidden" name="password" value="demo" />
            <button type="submit" className={buttonGhostClass}>
              Demo admin
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Account nahi hai?{" "}
        <Link href="/signup" className="font-semibold text-primary-text">
          Signup karo
        </Link>
        {" · "}
        <Link href="/forgot-password" className="font-semibold text-primary-text">
          Password bhool gaye?
        </Link>
      </p>
    </div>
  );
}
