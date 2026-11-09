// 404 — locale segment ke andar ka not-found.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted">Ye page nahi mila.</p>
      {/* Plain <a> — next-intl ka Link server component me static export
          ke time headers() padhta hai (getServerLocale). */}
      <a href="/login" className="mt-6 font-semibold text-primary-text">
        Login par jao →
      </a>
    </div>
  );
}
