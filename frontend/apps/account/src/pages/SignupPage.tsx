import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  cacheUser,
  fetchSession,
  renderTurnstile,
  resetTurnstile,
  type SignupInput,
} from "@kumbuild/lib";
import { redirectForRole } from "../lib/urls";
import AuthLayout from "../components/AuthLayout";
import {
  ErrorBanner,
  Field,
  SuccessBanner,
  buttonPrimaryClass,
  inputClass,
  inputErrorClass,
} from "../components/ui";

// account.kumbuild.com/signup — create a customer account (REAL backend).
// POST /api/auth/signup collects the backend's full §2 field set (contact
// + billing address) and emails a 6-digit OTP; the account stays
// "pending" until POST /api/auth/verify-email confirms the code, then
// the session works and the customer lands in the home app.

const FRIENDLY_FIELD_ERRORS: Record<string, string> = {
  required: "This field is required.",
  "invalid-name": "Enter your full name (at least 2 characters).",
  "invalid-email": "Enter a valid email address.",
  "invalid-phone": "Enter a valid phone number with country code (e.g. +91 98XXX XXXXX).",
  "invalid-pincode": "Enter a valid 6-digit pincode.",
  "weak-password":
    "Use at least 8 characters with an uppercase letter, a lowercase letter, a digit and a special character.",
};

function friendlyFieldError(code: string): string {
  return FRIENDLY_FIELD_ERRORS[code] ?? "Check this field.";
}

export default function SignupPage() {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [altEmail, setAltEmail] = useState("");
  const [billingName, setBillingName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("India");
  const [gstin, setGstin] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [existsError, setExistsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");

  // Already logged in (per the backend)? Go straight to the role app.
  useEffect(() => {
    let live = true;
    fetchSession().then((session) => {
      if (live && session) redirectForRole(session.role);
    });
    return () => {
      live = false;
    };
  }, []);

  // Turnstile widget (dev: Cloudflare always-pass test site key).
  useEffect(() => {
    if (step !== "form" || !turnstileRef.current) return;
    let cancelled = false;
    renderTurnstile(turnstileRef.current, (token) => {
      tokenRef.current = token;
    })
      .then((id) => {
        if (!cancelled) widgetIdRef.current = id;
      })
      .catch(() => {
        // Submit will surface the backend's turnstile error if attempted.
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  function fieldError(key: string): string {
    return errors[key] ?? "";
  }

  function clearField(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function textField(
    key: string,
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { type?: string; autoComplete?: string; placeholder?: string; optional?: boolean } = {},
  ) {
    const err = fieldError(key);
    return (
      <Field label={opts.optional ? `${label} (optional)` : label} error={err}>
        <input
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete}
          placeholder={opts.placeholder}
          value={value}
          onChange={(e) => {
            set(e.target.value);
            clearField(key);
          }}
          className={`${inputClass} ${err ? inputErrorClass : ""}`}
        />
      </Field>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setBanner("");
    setExistsError(false);
    if (password !== confirm) {
      setErrors({ confirm: "Passwords do not match." });
      return;
    }
    if (!tokenRef.current) {
      setBanner("Please complete the verification check, then try again.");
      return;
    }
    const input: SignupInput = {
      full_name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone_no: phone.trim(),
      whatsapp_no: (sameAsPhone ? phone : whatsapp).trim(),
      billing_name: billingName.trim(),
      address_line1: addressLine1.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country.trim() || "India",
      turnstile_token: tokenRef.current,
    };
    if (altEmail.trim()) input.alternative_email = altEmail.trim().toLowerCase();
    if (addressLine2.trim()) input.address_line2 = addressLine2.trim();
    if (gstin.trim()) input.gstin = gstin.trim();

    setBusy(true);
    try {
      await api.signup(input);
      setOtpNotice(`We sent a 6-digit verification code to ${input.email}. Enter it below to finish.`);
      setStep("otp");
    } catch (err) {
      if (widgetIdRef.current !== null) resetTurnstile(widgetIdRef.current);
      tokenRef.current = "";
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === "exists") {
          setExistsError(true);
        } else if (err.code === "email-failed") {
          // The account row exists; only the mail failed. Resend works.
          setOtpNotice(
            "Your account was created, but the verification email could not be sent. Use “Resend code” below.",
          );
          setStep("otp");
        } else if (err.fields && Object.keys(err.fields).length > 0) {
          const mapped: Record<string, string> = {};
          for (const [key, code] of Object.entries(err.fields)) {
            mapped[key] = friendlyFieldError(code);
          }
          setErrors(mapped);
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

  async function verify(e: FormEvent) {
    e.preventDefault();
    setCodeError("");
    setBanner("");
    setBusy(true);
    try {
      const { user } = await api.verifyEmail(email.trim().toLowerCase(), code.trim());
      cacheUser(user);
      redirectForRole("customer");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "too-many-attempts") {
          setCodeError("Too many wrong attempts — this code is cancelled. Request a new code below.");
        } else if (err.code === "invalid-code") {
          setCodeError("That code doesn't match. Check the email and try again.");
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

  async function resend() {
    setCodeError("");
    setBanner("");
    setBusy(true);
    try {
      const { message } = await api.resendOtp(email.trim().toLowerCase());
      setOtpNotice(message === "" ? "A new code is on its way if your account is pending verification." : message);
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Could not resend the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "otp") {
    return (
      <AuthLayout>
        <h1 className="text-center font-display text-2xl font-semibold text-ink">
          Verify your email
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          One last step — confirm the code we emailed you.
        </p>

        {otpNotice ? (
          <div className="mt-6">
            <SuccessBanner>{otpNotice}</SuccessBanner>
          </div>
        ) : null}
        {banner ? (
          <div className="mt-6">
            <ErrorBanner>{banner}</ErrorBanner>
          </div>
        ) : null}

        <form onSubmit={verify} className="mt-6 space-y-4" noValidate>
          <Field label="6-digit code" error={codeError}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError("");
              }}
              className={`${inputClass} ${codeError ? inputErrorClass : ""}`}
            />
          </Field>
          <button type="submit" className={buttonPrimaryClass} disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Didn&apos;t get the code?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="font-medium text-primary-700 hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-center font-display text-2xl font-semibold text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        Sign up to track your website order with Kumbuild.
      </p>

      {existsError ? (
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
      {banner ? (
        <div className="mt-6">
          <ErrorBanner>{banner}</ErrorBanner>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {textField("full_name", "Your name", name, setName, {
          autoComplete: "name",
          placeholder: "Ramesh Sharma",
        })}
        {textField("email", "Email", email, setEmail, {
          type: "email",
          autoComplete: "email",
          placeholder: "you@example.com",
        })}
        <Field
          label="Password"
          hint="At least 8 characters, with an uppercase letter, a lowercase letter, a digit and a special character."
          error={fieldError("password")}
        >
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearField("password");
            }}
            className={`${inputClass} ${fieldError("password") ? inputErrorClass : ""}`}
          />
        </Field>
        <Field label="Confirm password" error={fieldError("confirm")}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearField("confirm");
            }}
            className={`${inputClass} ${fieldError("confirm") ? inputErrorClass : ""}`}
          />
        </Field>
        {textField("phone_no", "Phone number", phone, setPhone, {
          type: "tel",
          autoComplete: "tel",
          placeholder: "+91 98765 43210",
        })}
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={sameAsPhone}
            onChange={(e) => setSameAsPhone(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          WhatsApp number is the same as phone
        </label>
        {!sameAsPhone
          ? textField("whatsapp_no", "WhatsApp number", whatsapp, setWhatsapp, {
              type: "tel",
              placeholder: "+91 98765 43210",
            })
          : null}
        {textField("alternative_email", "Alternative email", altEmail, setAltEmail, {
          type: "email",
          autoComplete: "email",
          placeholder: "other@example.com",
          optional: true,
        })}

        <fieldset className="space-y-4 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Billing address</legend>
          {textField("billing_name", "Billing name", billingName, setBillingName, {
            placeholder: "Name on the invoice",
          })}
          {textField("address_line1", "Address line 1", addressLine1, setAddressLine1, {
            autoComplete: "address-line1",
            placeholder: "House / street / area",
          })}
          {textField("address_line2", "Address line 2", addressLine2, setAddressLine2, {
            autoComplete: "address-line2",
            optional: true,
          })}
          {textField("city", "City", city, setCity, { autoComplete: "address-level2" })}
          {textField("state", "State", state, setState, { autoComplete: "address-level1" })}
          {textField("pincode", "Pincode", pincode, setPincode, {
            autoComplete: "postal-code",
            placeholder: "110001",
          })}
          {textField("country", "Country", country, setCountry, { autoComplete: "country-name" })}
          {textField("gstin", "GSTIN", gstin, setGstin, { optional: true, placeholder: "22AAAAA0000A1Z5" })}
        </fieldset>

        <div ref={turnstileRef} className="flex justify-center" />
        <button type="submit" className={buttonPrimaryClass} disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
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
