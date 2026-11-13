import {
  Children,
  cloneElement,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { Label } from "@radix-ui/react-label";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Shared auth-page bits — canonical theme tokens only (see index.css,
// THEME.md v3): light + dark. Orange (#C2410C) is order-buttons only
// and is NOT used anywhere here.

/**
 * A labelled form field with full a11y wiring. The single child is the
 * input element (or an input component such as PasswordInput/PhoneInput
 * that forwards its props to the real <input>); Field clones it and
 * injects a stable id, aria-invalid, and aria-describedby linking the
 * error text (preferred) or the hint. The error/hint spans carry the
 * matching ids, so screen readers announce them with the field.
 */
export function Field({
  id,
  label,
  error,
  hint,
  labelAction,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Extra control on the label row, right-aligned (e.g. "Forgot password?"). */
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, !error && hint ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const input = cloneElement(
    Children.only(children) as ReactElement<Record<string, unknown>>,
    {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  });
  return (
    <div className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </Label>
        {labelAction ?? null}
      </div>
      {input}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs font-medium text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
};

/**
 * Password input with a Show/Hide toggle — a real <button> with
 * aria-pressed + aria-label. Forwards id / aria-* / ref (e.g. from
 * react-hook-form's register) to the real <input>.
 */
export function PasswordInput({
  show,
  onToggleShow,
  className,
  ref,
  ...inputProps
}: InputProps & { show: boolean; onToggleShow: () => void }) {
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        {...inputProps}
        className={`${inputClass} pr-16 ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-pressed={show}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-2 px-2 text-xs font-medium text-primary-700 hover:underline"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/**
 * Indian mobile field with a fixed +91 prefix treatment. Forwards
 * id / aria-* / ref (e.g. from react-hook-form's register) to the
 * real <input>; `className` (e.g. the error border) goes on the
 * wrapper box.
 */
export function PhoneInput({ className, ref, ...inputProps }: InputProps) {
  return (
    <div
      className={`${inputClass} flex items-center gap-2 p-0 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/30 ${
        className ?? ""
      }`}
    >
      <span className="select-none border-r border-line py-2 pl-3 pr-2 font-medium text-muted">
        +91
      </span>
      <input
        ref={ref}
        type="tel"
        {...inputProps}
        className="w-full bg-transparent py-2 pr-3 text-sm text-ink outline-none placeholder:text-faint"
      />
    </div>
  );
}

/** Mount fade for a form/stage — skipped entirely under reduced motion. */
export function FadeIn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Directional slide for the signup wizard steps: the incoming step
 * slides in from the right when moving forward, from the left when
 * going back (0.25s, the app's ease-out curve). Under reduced motion
 * the step just swaps — no slide at all.
 */
export function StepSlide({
  stepKey,
  direction,
  children,
}: {
  stepKey: number;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div key={stepKey}>{children}</div>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: direction === "forward" ? 24 : -24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction === "forward" ? -24 : 24 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-primary-600 focus:ring-2 focus:ring-primary-600/30";

export const inputErrorClass = "border-danger focus:border-danger focus:ring-danger/30";

export const buttonPrimaryClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 dark:hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50";

export function ErrorBanner({
  children,
  ref,
}: {
  children: ReactNode;
  /** Focus target for server errors (e.g. login 401): tabIndex -1 keeps
      it out of the tab order, focusable only programmatically. */
  ref?: Ref<HTMLParagraphElement>;
}) {
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg border border-danger/30 bg-error-bg px-3 py-2 text-sm font-medium text-danger"
    >
      {children}
    </p>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-primary-200 bg-primary-tint px-3 py-2 text-sm font-medium text-primary-700">
      {children}
    </p>
  );
}
