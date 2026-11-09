import { loginAction, DEMO_CUSTOMER_EMAIL } from "@/lib/auth";
import { buttonPrimaryClass, Field, inputClass } from "@/components/ui";

// Verify — auth.kumbuild.com/verify. MOCK: koi bhi 6-digit code chalta hai.
// Verify karne par demo customer login ho jata hai (backend aane pe yahan
// asli OTP/email verification hogi).
export default function VerifyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Verify your account</h1>
      <p className="mt-1 text-sm text-muted">
        Email / WhatsApp par aaya 6-digit code likho. Mock me koi bhi 6-digit
        code chalta hai.
      </p>

      <form action={loginAction} className="mt-6 space-y-4">
        <input type="hidden" name="email" value={DEMO_CUSTOMER_EMAIL} />
        <input type="hidden" name="password" value="demo" />
        <Field label="6-digit code">
          <input
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            required
            placeholder="123456"
            className={`${inputClass} tracking-[0.5em]`}
          />
        </Field>
        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Verify
        </button>
      </form>
    </div>
  );
}
