import { ORDER_STATUS_LABEL, type OrderStatus } from "@kumbuild/lib";

const BADGE_STYLES: Record<OrderStatus, string> = {
  received: "border-line bg-surface text-muted",
  "in-progress": "border-primary-100 bg-primary-50 text-primary-700",
  "preview-ready": "border-primary-100 bg-primary-50 text-primary-700",
  revision: "border-primary-100 bg-primary-50 text-primary-700",
  approved: "border-primary-200 bg-primary-100 text-primary-800",
  live: "border-transparent bg-live-soft text-live",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
