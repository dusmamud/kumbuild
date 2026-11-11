import {
  payments,
  type Order,
  type OrderStatus,
  type Payment,
} from "@kumbuild/lib";

/** ₹7,999 style — en-IN grouping, no decimals. */
export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** "2026-11-02" -> "2 Nov 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Total of Paid payments for one order (mock phase). */
export function paidTotal(orderId: string): number {
  return payments
    .filter((p) => p.orderId === orderId && p.status === "Paid")
    .reduce((sum, p) => sum + p.amount, 0);
}

/** What's still owed: price minus what has actually been paid. */
export function balanceDue(order: Order): number {
  return Math.max(0, order.price - paidTotal(order.id));
}

/** Pending payments raised for the given orders. */
export function pendingPaymentsFor(orderIds: string[]): Payment[] {
  return payments.filter(
    (p) => orderIds.includes(p.orderId) && p.status === "Pending",
  );
}

/** WhatsApp link with a prefilled message. No phone number is configured
    yet, so this goes to wa.me with text only. */
export function waLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** One honest line per status — what the customer should expect next. */
export const NEXT_STEP: Record<OrderStatus, string> = {
  received: "We've got your order — we'll start shortly.",
  "in-progress": "Your website is being built.",
  "preview-ready": "Your preview is ready — take a look.",
  revision: "We're applying your changes.",
  approved: "Approved — final payment pending, then we go live.",
  live: "Your website is live.",
};
