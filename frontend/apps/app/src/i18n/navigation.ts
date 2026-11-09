import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation: Link href="/orders" likhne par current locale
// ka prefix khud lag jata hai (default locale par kuch nahi lagta).
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
