import { Link } from "@/i18n/navigation";
import { buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Forgot password — auth.kumbuild.com/forgot-password.
// MOCK: koi email/OTP asal me nahi bheja jata. Form bharne par verify
// page ka link dikhata hai (backend aane pe yahan reset link jayega).
export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted">
        Apna email likho — reset link / OTP bhejenge (mock me kuch nahi bheja
        jata).
      </p>

      <form className="mt-6 space-y-4" action="/verify">
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
