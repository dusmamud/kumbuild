import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  SuccessBanner,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/forgot-password — mirrors the Next.js admin app's
// ForgotPasswordPage (same labels/behaviour). MOCK: no email is actually
// sent in this phase; the success state says so plainly.

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [email, setEmail] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(true);
      return;
    }
    setError(false);
    setSent(true);
  }

  return (
    <AuthLayout>
      <h1 className="text-center font-display text-2xl font-semibold text-ink">
        Forgot password
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        Enter your account email — we&apos;ll send a reset link if an account exists.
      </p>

      {error ? (
        <div className="mt-6">
          <ErrorBanner>Enter a valid email address.</ErrorBanner>
        </div>
      ) : null}
      {sent ? (
        <div className="mt-6 space-y-2">
          <SuccessBanner>
            If an account exists for this email, a reset link was sent.
          </SuccessBanner>
          <p className="text-xs text-muted">
            Mock phase: no email is actually sent yet. The reset flow will be wired to the Go
            backend later.
          </p>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(false);
            }}
            className={`${inputClass} ${error ? inputErrorClass : ""}`}
          />
        </Field>
        <button type="submit" className={buttonPrimaryClass}>
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-primary-700 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
