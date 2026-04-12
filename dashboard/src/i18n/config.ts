export const defaultLocale = "en" as const;
export const supportedLocales = ["en", "de"] as const;
export type Locale = (typeof supportedLocales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
};
