"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { supportedLocales, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const router = useRouter();
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("common");
  const [isLoading, setIsLoading] = useState(false);

  const handleLanguageChange = async (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    setIsLoading(true);
    try {
      // Set cookie for server-side locale
      await fetch("/api/set-locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });

      // Set localStorage for client-side persistence
      localStorage.setItem("dashboard.locale", newLocale);

      // Refresh the page to re-render with new locale
      router.refresh();
    } catch (error) {
      console.error("Failed to change language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-t border-[#e5e5e5] px-6 py-3 mt-3">
      <label className="block text-xs font-medium text-[#777169] mb-2">
        {t("language")}
      </label>
      <select
        value={currentLocale}
        onChange={(e) => handleLanguageChange(e.target.value as Locale)}
        disabled={isLoading}
        className="w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-1.5 text-sm text-black focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50 cursor-pointer"
      >
        {supportedLocales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}
