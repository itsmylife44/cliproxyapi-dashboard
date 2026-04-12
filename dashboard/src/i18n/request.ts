import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, supportedLocales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get("locale")?.value;
  const locale: Locale = supportedLocales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
