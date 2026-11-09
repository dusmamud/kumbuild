import { forgotPasswordAction } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Forgot password — auth.kumbuild.com/forgot-password (sirf admin ke liye).
// MOCK: koi email/OTP asal me nahi bheja jata. Form bharne par sent message
// dikhata hai (backend aane pe yahan reset link jayega).
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted">
        Apna admin email likho — reset link / OTP bhejenge (mock me kuch nahi
        bheja jata).
      </p>

      {error === "invalid-email" ? (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error">
          Sahi email address likho.
        </p>
      ) : null}
      {sent === "1" ? (
        <p className="mt-4 rounded-lg bg-primary-tint px-3 py-2 text-sm font-medium text-primary-text">
          Mock hai — koi email nahi bheja gaya. Backend aane pe yahan reset
          link jayega.
        </p>
      ) : null}

      <form className="mt-6 space-y-4" action={forgotPasswordAction}>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="admin@kumbuild.com"
            className={inputClass}
          />
        </Field>
        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary-text">
          Back to login
        </Link>
      </p>
    </div>
  );
}
