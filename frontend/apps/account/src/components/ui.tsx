import type { ReactNode } from "react";

// Shared auth-page bits — canonical theme tokens only (see index.css,
// THEME.md v3): light + dark. Orange (#C2410C) is order-buttons only
// and is NOT used anywhere here.

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-primary-600 focus:ring-2 focus:ring-primary-600/30";

export const inputErrorClass = "border-danger focus:border-danger focus:ring-danger/30";

export const buttonPrimaryClass =
  "inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 dark:hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50";

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
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
