import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DEMO_ADMIN_EMAIL,
  encodeDemoSession,
  getSession,
  login,
  logout,
  type Session,
} from "@kumbuild/lib";
import { ADMIN_URL, HOME_URL, redirectForRole } from "../lib/urls";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/login — central login (mock phase).
// Success: role app (admin -> admin.kumbuild.com, customer ->
// home.kumbuild.com) with the demo_session handoff. ?next= overrides the
// role default: a relative path goes to the role app, an absolute URL is
// honoured only if it is on admin/home.kumbuild.com.

const DEMO_CUSTOMER_EMAIL = "customer@example.com";
const DEMO_PASSWORD = "demo1234";

function redirectAfterLogin(session: Session, next: string | null): void {
  const demo = encodeDemoSession(session);
  const base = session.role === "admin" ? ADMIN_URL : HOME_URL;
  if (next) {
    if (next.startsWith("/") && !next.startsWith("//")) {
      const url = new URL(`${base}${next}`);
      url.searchParams.set("demo_session", demo);
      window.location.href = url.toString();
      return;
    }
    try {
      const url = new URL(next);
      const allowed = [new URL(ADMIN_URL).origin, new URL(HOME_URL).origin];
      if (allowed.includes(url.origin)) {
        url.searchParams.set("demo_session", demo);
        window.location.href = url.toString();
        return;
      }
    } catch {
      // Not a valid URL — fall through to the role default.
    }
  }
  redirectForRole(session.role, demo);
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [banner, setBanner] = useState("");

  // Already logged in? Skip the form — go straight to the role app.
  // Except after an explicit logout (?logged_out=1): the role apps hold
  // their own copy of the mock session (per-origin localStorage), so
  // clear THIS origin's stale copy and show the form instead of
  // bouncing straight back to the app the user just left.
  useEffect(() => {
    if (searchParams.get("logged_out") === "1") {
      logout();
      const next = new URLSearchParams(searchParams);
      next.delete("logged_out");
      const qs = next.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      return;
    }
    const session = getSession();
    if (session) {
      redirectForRole(session.role, encodeDemoSession(session));
    }
  }, []);

  function clearErrors() {
    setEmailError("");
    setPasswordError("");
    setBanner("");
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    clearErrors();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    clearErrors();
    const res = login(email, password);
    if (!res.ok) {
      if (res.error === "invalid-email") {
        setEmailError("Enter a valid email address.");
      } else if (res.error === "short-password") {
        setPasswordError("Password must be at least 6 characters.");
      } else if (res.error === "not-found") {
        setBanner("No account found with this email. Check the email, or sign up for a new account.");
      } else {
        setBanner("Wrong password. Try again, or reset it with “Forgot password?”.");
      }
      return;
    }
    redirectAfterLogin(res.session, searchParams.get("next"));
  }

  return (
    <AuthLayout>
      <h1 className="text-center font-display text-2xl font-semibold text-ink">
        Log in to Kumbuild
      </h1>
      <p className="mt-1 text-center text-sm text-muted">Log in to continue to Kumbuild.</p>

      {banner ? (
        <div className="mt-6">
          <ErrorBanner>{banner}</ErrorBanner>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" error={emailError}>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError("");
            }}
            className={`${inputClass} ${emailError ? inputErrorClass : ""}`}
          />
        </Field>
        <Field label="Password" error={passwordError}>
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
            className={`${inputClass} ${passwordError ? inputErrorClass : ""}`}
          />
        </Field>
        <button type="submit" className={buttonPrimaryClass}>
          Log in
        </button>
      </form>

      <div className="mt-6 rounded-lg border border-primary-100 bg-primary-50 p-3">
        <p className="text-xs font-semibold text-primary-700">Demo accounts — mock phase</p>
        <p className="mt-1 text-xs text-body">
          No real password yet — any password (6+ characters) works in this mock phase. Tap one
          to fill it in.
        </p>
        <div className="mt-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fillDemo(DEMO_ADMIN_EMAIL)}
            className="rounded-md px-2 py-1 text-left text-xs font-medium text-primary-700 hover:bg-primary-100"
          >
            {DEMO_ADMIN_EMAIL} — Admin (Dus Mamud)
          </button>
          <button
            type="button"
            onClick={() => fillDemo(DEMO_CUSTOMER_EMAIL)}
            className="rounded-md px-2 py-1 text-left text-xs font-medium text-primary-700 hover:bg-primary-100"
          >
            {DEMO_CUSTOMER_EMAIL} — Customer (Ramesh Sharma)
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/forgot-password" className="font-medium text-primary-700 hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-primary-700 hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
