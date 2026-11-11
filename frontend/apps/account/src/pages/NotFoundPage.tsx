import { WEB_URL } from "../lib/urls";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Page not found</h1>
      <a href={WEB_URL} className="text-sm font-medium text-primary-700 underline underline-offset-4">
        Back to kumbuild.com
      </a>
    </main>
  );
}
