import type { ReactNode } from "react";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@kumbuild/lib";

// Chhote shared UI bits — sab theme tokens (index.css) use karte hain,
// kabhi hard-coded colour nahi. Ported from the Next.js app's ui.tsx.

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  received: "bg-primary-tint text-primary-text",
  "in-progress": "bg-primary-tint text-primary-text",
  "preview-ready": "bg-warning-bg text-warning",
  revision: "bg-warning-bg text-warning",
  approved: "bg-success-bg text-success",
  live: "bg-success-bg text-success",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/30";

export const buttonPrimaryClass =
  "inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600/50 disabled:opacity-50";

export const buttonGhostClass =
  "inline-flex items-center justify-center rounded-lg border border-line-strong bg-bg px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary-600/30";
