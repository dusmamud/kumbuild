import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Kumbuild app — admin login + admin dashboard, ONE Next.js app (ARCHITECTURE.md).
// Deploy: STATIC export -> Cloudflare Pages (DEPLOYMENT.md).
// Koi server nahi hai: no proxy/middleware, no server actions, no SSR.
// Session localStorage me hai, guards client-side hain (src/lib/auth.ts).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Static export: `pnpm build` pure HTML/CSS/JS banata hai (out/),
  // jo Cloudflare Pages pe seedha host hota hai.
  // Static export: `pnpm build` pure HTML/CSS/JS banata hai (out/),
  // jo Cloudflare Pages pe seedha host hota hai.
  output: "export",
  // Workspace packages are TS source — transpile them into the app bundle.
  transpilePackages: ["@kumbuild/config", "@kumbuild/lib"],
};

export default withNextIntl(nextConfig);
