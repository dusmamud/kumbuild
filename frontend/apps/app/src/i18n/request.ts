import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { getDictionary } from "@kumbuild/lib/i18n";
import { routing } from "./routing";

// Messages SHARED dictionaries se aate hain — packages/lib/src/i18n/*.json.
// Is app me strings ki apni copy NAHI hai (THEME.md Section 6.3).
// Koi key missing ho to getDictionary en-US fallback deta hai.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: getDictionary(locale),
  };
});
