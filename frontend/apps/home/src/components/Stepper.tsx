import { Check } from "lucide-react";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from "@kumbuild/lib";

const STEP_DESC: Record<OrderStatus, string> = {
  received: "We've got your order.",
  "in-progress": "Your website is being built.",
  "preview-ready": "Your preview is ready to review.",
  revision: "We're applying your changes.",
  approved: "Approved — ready to go live.",
  live: "Your website is live.",
};

export default function Stepper({ status }: { status: OrderStatus }) {
  const current = ORDER_STATUSES.indexOf(status);
  return (
    <ol>
      {ORDER_STATUSES.map((step, i) => {
        const state =
          i < current ? "done" : i === current ? "current" : "todo";
        const isLast = i === ORDER_STATUSES.length - 1;
        return (
          <li key={step} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute top-8 left-4 h-[calc(100%-2rem)] w-px ${
                  state === "todo" ? "bg-line" : "bg-primary-600"
                }`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                state === "done"
                  ? "border-primary-600 bg-primary-600 text-white"
                  : state === "current"
                    ? "border-primary-600 bg-white"
                    : "border-line bg-white"
              }`}
            >
              {state === "done" ? (
                <Check className="h-4 w-4" strokeWidth={3} />
              ) : state === "current" ? (
                <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
              )}
            </span>
            <div className="pt-1">
              <p
                className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${
                  state === "todo" ? "text-muted" : "text-ink"
                }`}
              >
                {ORDER_STATUS_LABEL[step]}
                {state === "current" && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                    Current step
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-muted">{STEP_DESC[step]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
