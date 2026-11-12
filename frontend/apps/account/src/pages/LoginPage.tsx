import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  ApiError,
  cacheUser,
  fetchSession,
  logout,
  renderTurnstile,
  resetTurnstile,
  sessionForUser,
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

// account.kumbuild.com/login — central login (REAL backend).
// POST /api/auth/login (Go API, session cookie). Success: role app
// (staff -> admin app, customer -> home app); the sibling apps validate
// the same cookie themselves via /api/auth/me, so no session handoff is
// needed. ?next= overrides the role default: a relative path goes to the
// role app, an absolute URL is honoured only if it is on the admin/home
// app origin.

function redirectAfterLogin(session: Session, next: string | null): void {
  const base = session.role === "admin" ? ADMIN_URL : HOME_URL;
  if (next) {
    if (next.startsWith("/") && !next.startsWith("//")) {
      window.location.href = `${base}${next}`;
      return;
    }
    try {
      const url = new URL(next);
      const allowed = [new URL(ADMIN_URL).origin, new URL(HOME_URL).origin];
      if (allowed.includes(url.origin)) {
        window.location.href = url.toString();
        return;
      }
    } catch {
      // Not a valid URL — fall through to the role default.
    }
  }
  redirectForRole(session.role);
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  // Turnstile widget (dev: Cloudflare always-pass test site key).
  useEffect(() => {
    let cancelled = false;
    if (turnstileRef.current) {
      renderTurnstile(turnstileRef.current, (token) => {
        tokenRef.current = token;
      })
        .then((id) => {
          if (!cancelled) widgetIdRef.current = id;
        })
        .catch(() => {
          // Widget failed to load — submit will surface the backend's
          // turnstile-required error if attempted without a token.
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Already logged in? Ask the backend (/me) — skip the form and go
  // straight to the role app. Except after an explicit logout
  // (?logged_out=1): end the server session and show the form instead
  // of bouncing straight back.
  useEffect(() => {
    if (searchParams.get("logged_out") === "1") {
      void logout();
      const next = new URLSearchParams(searchParams);
      next.delete("logged_out");
      const qs = next.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      return;
    }
    let live = true;
    fetchSession().then((session) => {
      if (live && session) {
        redirectAfterLogin(session, searchParams.get("next"));
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearErrors() {
    setEmailError("");
    setPasswordError("");
    setBanner("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    clearErrors();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setPasswordError("Enter your password.");
      return;
    }
    if (!tokenRef.current) {
      setBanner("Please complete the verification check, then try again.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await api.login(normalized, password, tokenRef.current);
      cacheUser(user);
      redirectAfterLogin(sessionForUser(user), searchParams.get("next"));
    } catch (err) {
      // Turnstile tokens are single-use — reset for the next attempt.
      if (widgetIdRef.current !== null) resetTurnstile(widgetIdRef.current);
      tokenRef.current = "";
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setBanner(
            "Invalid email or password. If you just signed up, verify your email first — unverified accounts can't log in.",
          );
        } else if (err.fields?.password) {
          setPasswordError(err.message);
        } else {
          setBanner(err.message);
        }
      } else {
        setBanner("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
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
        <div ref={turnstileRef} className="flex justify-center" />
        <button type="submit" className={buttonPrimaryClass} disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>

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
