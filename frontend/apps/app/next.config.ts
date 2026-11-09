import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Kumbuild app — auth + home + admin, ONE Next.js app (ARCHITECTURE.md).
// Deploy: @opennextjs/cloudflare (DEPLOYMENT.md) — normal middleware only,
// no `runtime = "edge"`, no Node.js middleware.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace packages are TS source — transpile them into the app bundle.
  transpilePackages: ["@kumbuild/config", "@kumbuild/lib"],
};

export default withNextIntl(nextConfig);
