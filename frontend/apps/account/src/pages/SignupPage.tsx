import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { encodeDemoSession, getSession, signup } from "@kumbuild/lib";
import { redirectForRole } from "../lib/urls";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/signup — create a customer account (mock phase).
// Success: customer session, straight to the home app with the
// demo_session handoff. No terms/privacy claims here — mock phase only.

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [banner, setBanner] = useState("");

  // Already logged in? Skip the form — go straight to the role app.
  useEffect(() => {
    const session = getSession();
    if (session) {
      redirectForRole(session.role, encodeDemoSession(session));
    }
  }, []);

  function clearErrors() {
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setBanner("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    clearErrors();
    if (password !== confirm) {
      setConfirmError("Passwords do not match.");
      return;
    }
    const res = signup(name, email, password);
    if (!res.ok) {
      if (res.error === "invalid-name") {
        setNameError("Enter your name (at least 2 characters).");
      } else if (res.error === "invalid-email") {
        setEmailError("Enter a valid email address.");
      } else if (res.error === "short-password") {
        setPasswordError("Password must be at least 6 characters.");
      } else {
        setBanner("exists");
      }
      return;
    }
    redirectForRole(res.session.role, encodeDemoSession(res.session));
  }

  return (
    <AuthLayout>
      <h1 className="text-center font-display text-2xl font-semibold text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        Sign up to track your website order with Kumbuild.
      </p>

      {banner === "exists" ? (
        <div className="mt-6">
          <ErrorBanner>
            An account with this email already exists —{" "}
            <Link to="/login" className="font-semibold underline underline-offset-2">
              log in instead
            </Link>
            .
          </ErrorBanner>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Your name" error={nameError}>
          <input
            type="text"
            required
            autoComplete="name"
            placeholder="Ramesh Sharma"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError("");
            }}
            className={`${inputClass} ${nameError ? inputErrorClass : ""}`}
          />
        </Field>
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
        <Field
          label="Password"
          hint="At least 6 characters."
          error={passwordError}
        >
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
            className={`${inputClass} ${passwordError ? inputErrorClass : ""}`}
          />
        </Field>
        <Field label="Confirm password" error={confirmError}>
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setConfirmError("");
            }}
            className={`${inputClass} ${confirmError ? inputErrorClass : ""}`}
          />
        </Field>
        <button type="submit" className={buttonPrimaryClass}>
          Sign up
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
