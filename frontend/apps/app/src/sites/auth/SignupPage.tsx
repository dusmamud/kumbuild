import { signupAction } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Signup — auth.kumbuild.com/signup. MOCK: form bharo, account "ban" jata
// hai aur turant customer login ho jata hai. Koi data kahin save nahi hota.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-muted">
        Order karne ke baad yahi account tumhara dashboard banega.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Naam aur sahi email address dono likho.
        </p>
      ) : null}

      <form action={signupAction} className="mt-6 space-y-4">
        <Field label="Your name">
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Ramesh Sharma"
            className={inputClass}
          />
        </Field>
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
        <Field label="Phone (WhatsApp)">
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            className={inputClass}
          />
        </Field>
        <Field label="Password" hint="Mock hai — ye password kahin save nahi hoga.">
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass}
          />
        </Field>
        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Pehle se account hai?{" "}
        <Link href="/login" className="font-semibold text-primary-text">
          Login karo
        </Link>
      </p>
    </div>
  );
}
