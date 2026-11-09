import { NextResponse, type NextRequest } from "next/server";

// Kumbuild app — ONE Next.js app, do subdomains (ARCHITECTURE.md Section 5).
// Ye proxy (Next 16 me middleware ka naya naam) host dekh ke route karta hai:
//   auth.kumbuild.com  -> (auth)  — admin login / forgot-password
//   admin.kumbuild.com -> (admin) — admin dashboard
// Customer dashboard (home) hata diya gaya (2026-11-09, landing + admin
// only) — customer ka koi account nahi hai. `home.*` host aaye to seedha
// kumbuild.com pe bhej do (SUBDOMAINS.md Redirects).
// Saath me locale routing bhi yahi karta hai (next-intl middleware ki jagah,
// taaki subdomain + locale ek hi jagah compose ho):
//   en-US default, URL me prefix nahi; hi -> /hi/, bn -> /bn/ (THEME.md 6.2).
//
// Local dev: *.localhost trick (auth.localhost:3000) ya plain localhost par
// path fallback (/auth/login, /admin) — README dekho.
//
// NOTE: ye sirf UX guard hai, security nahi (ARCHITECTURE.md Section 9).
// Asli role check backend karega.

type Group = "auth" | "admin";
type Role = "admin";

interface Session {
  role: Role;
  name: string;
  email: string;
}

const GROUPS: Group[] = ["auth", "admin"];
const LOCALES = ["en-US", "hi", "bn"] as const;
const SESSION_COOKIE = "kb_session";
const LOCALE_COOKIE = "NEXT_LOCALE";

/** Edge runtime me Buffer nahi hota — base64url decode atob se. */
function decodeSession(value: string): Session | null {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as Session;
    // Admin-only app: sirf admin role wali session valid hai. Purani
    // customer session (agar cookie bachi ho) invalid mani jayegi.
    if (parsed.role !== "admin") return null;
    if (typeof parsed.email !== "string" || !parsed.email.includes("@"))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function detectLocaleFromHeader(
  acceptLanguage: string | null,
): (typeof LOCALES)[number] {
  if (!acceptLanguage) return "en-US";
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("hi")) return "hi";
  if (first.startsWith("bn")) return "bn";
  return "en-US";
}

interface Addressing {
  /** "subdomain": host me hi group hai (auth.localhost / home.kumbuild.com). */
  mode: "subdomain" | "path";
  group: Group;
  /** Path fallback mode me URL se group prefix hatane ke baad ka path. */
  path: string;
  locale: (typeof LOCALES)[number];
  localeInPath: boolean;
}

function parseRequest(req: NextRequest): Addressing {
  const host = req.headers.get("host") ?? "";
  const bare = host.split(":")[0].toLowerCase();
  const parts = bare.split(".");
  let group: Group = "auth";
  let mode: Addressing["mode"] = "path";
  let path = req.nextUrl.pathname;
  let locale: (typeof LOCALES)[number] = "en-US";
  let localeInPath = false;

  if (
    parts.length >= 2 &&
    GROUPS.includes(parts[0] as Group) &&
    (bare.endsWith(".localhost") || bare.endsWith(".kumbuild.com"))
  ) {
    // auth.localhost:3000, admin.kumbuild.com, ...
    group = parts[0] as Group;
    mode = "subdomain";
  } else {
    // Plain localhost / preview domain: /auth/..., /admin/...
    // Locale pehle bhi aa sakta hai: /hi/admin/orders aur /admin/hi/orders
    // dono chalte hain (canonical form group-first hai).
    const segs = path.split("/").filter(Boolean);
    let rest = segs;
    if (GROUPS.includes(segs[0] as Group)) {
      group = segs[0] as Group;
      rest = segs.slice(1);
    } else if (segs[0] === "hi" || segs[0] === "bn") {
      locale = segs[0];
      localeInPath = true;
      rest = segs.slice(1);
      if (GROUPS.includes(rest[0] as Group)) {
        group = rest[0] as Group;
        rest = rest.slice(1);
      }
    }
    path = rest.length > 0 ? `/${rest.join("/")}` : "/";
  }

  if (!localeInPath) {
    const firstSeg = path.split("/")[1];
    if (firstSeg === "hi" || firstSeg === "bn") {
      locale = firstSeg;
      localeInPath = true;
      path = path.slice(firstSeg.length + 1) || "/";
    }
  }
  return { mode, group, path, locale, localeInPath };
}

/** Dusre group ka URL banata hai — host ke hisaab se subdomain ya path. */
function groupUrl(
  req: NextRequest,
  addressing: Addressing,
  target: Group,
  targetPath: string,
  locale?: (typeof LOCALES)[number],
): URL {
  const localePrefix =
    locale && locale !== "en-US" ? `/${locale}` : "";
  const cleanPath = targetPath === "/" ? "/" : targetPath;
  if (addressing.mode === "subdomain") {
    const url = req.nextUrl.clone();
    const host = req.headers.get("host") ?? "";
    const [bare, port] = host.split(":");
    const parts = bare.split(".");
    parts[0] = target;
    url.host = port ? `${parts.join(".")}:${port}` : parts.join(".");
    url.pathname = `${localePrefix}${cleanPath}`;
    url.search = "";
    return url;
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${target}${localePrefix}${cleanPath}`;
  url.search = "";
  return url;
}

/** Isi group me locale-prefixed URL (locale redirect ke liye). */
function localeUrl(
  req: NextRequest,
  addressing: Addressing,
  locale: (typeof LOCALES)[number],
): URL {
  const url = req.nextUrl.clone();
  if (addressing.mode === "subdomain") {
    url.pathname = `/${locale}${addressing.path === "/" ? "/" : addressing.path}`;
  } else {
    url.pathname = `/${addressing.group}/${locale}${addressing.path === "/" ? "/" : addressing.path}`;
  }
  url.search = "";
  return url;
}

export default function proxy(req: NextRequest) {
  // home.* host (purana customer dashboard) — ab nahi hai, seedha
  // kumbuild.com (landing) pe bhej do (SUBDOMAINS.md Redirects).
  const host = req.headers.get("host") ?? "";
  const bareHost = host.split(":")[0].toLowerCase();
  if (bareHost === "home.kumbuild.com" || bareHost === "home.localhost") {
    return NextResponse.redirect(new URL("https://kumbuild.com/"));
  }

  const addressing = parseRequest(req);
  const { group, path } = addressing;
  const session = decodeSession(
    req.cookies.get(SESSION_COOKIE)?.value ?? "",
  );
  const isGet = req.method === "GET" || req.method === "HEAD";

  // 1. Locale resolve — URL prefix jeetega (THEME.md 6.2 detection priority:
  // URL > cookie > Accept-Language > default).
  if (!addressing.localeInPath && isGet) {
    const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
    const resolved =
      cookieLocale === "hi" || cookieLocale === "bn"
        ? cookieLocale
        : cookieLocale === "en-US"
          ? "en-US"
          : detectLocaleFromHeader(req.headers.get("accept-language"));
    if (resolved !== "en-US") {
      return NextResponse.redirect(localeUrl(req, addressing, resolved));
    }
  }

  // 2. Guards — SUBDOMAINS.md guards matrix. Sirf GET par redirect karte
  // hain taaki form POST (server actions) na toote.
  if (isGet) {
    if (group === "auth") {
      if (path === "/") {
        // auth root par koi page nahi — seedha login.
        return NextResponse.redirect(
          groupUrl(req, addressing, "auth", "/login", addressing.locale),
        );
      }
      if (session) {
        // Pehle se logged-in admin — dobara login page mat dikhao.
        return NextResponse.redirect(
          groupUrl(req, addressing, "admin", "/", addressing.locale),
        );
      }
    }
    if (group === "admin") {
      if (!session || session.role !== "admin") {
        return NextResponse.redirect(
          groupUrl(req, addressing, "auth", "/login", addressing.locale),
        );
      }
    }
  }

  // 3. Rewrite — visible URL wahi, andar [locale] + [site] segment.
  //    /login            -> /en-US/auth/login
  //    /hi/orders        -> /hi/admin/orders
  // [site] segment zaroori hai: (auth)/(admin) route groups se
  // build fail hota hai (same-path conflict) — src/lib/site.ts dekho.
  const url = req.nextUrl.clone();
  url.pathname = `/${addressing.locale}/${group}${path}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // /api, /_next aur static files (dot wale paths, jaise /logo/*.svg)
  // locale redirect se bahar — warna images/API 404 honge.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
