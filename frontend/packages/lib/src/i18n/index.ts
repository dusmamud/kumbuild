import enUS from "./en-US.json";
import hi from "./hi.json";
import bn from "./bn.json";
import type { Locale } from "@kumbuild/config";

export const dictionaries = { "en-US": enUS, hi, bn } as const;

export type Dictionary = typeof enUS;

/** Get the dictionary for a locale, falling back to en-US (THEME.md rule). */
export function getDictionary(locale: string): Dictionary {
  return (dictionaries as Record<string, Dictionary>)[locale] ?? enUS;
}

export function isLocale(value: string): value is Locale {
  return value === "en-US" || value === "hi" || value === "bn";
}
