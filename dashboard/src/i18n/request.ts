import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, supportedLocales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;

  // Validate and fallback to default
  const locale: Locale = 
    localeCookie && supportedLocales.includes(localeCookie as Locale)
      ? (localeCookie as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
