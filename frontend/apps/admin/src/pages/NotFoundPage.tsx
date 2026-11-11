import { Link } from "react-router-dom";
import { WEB_URL } from "../lib/urls";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Page not found</h1>
      <p className="text-sm text-muted">Ye page admin dashboard me nahi hai.</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link to="/" className="text-sm font-semibold text-primary-text hover:underline">
          ← Back to dashboard
        </Link>
        <a href={WEB_URL} className="text-sm font-medium text-primary-700 underline underline-offset-4">
          Back to kumbuild.com
        </a>
      </div>
    </div>
  );
}
