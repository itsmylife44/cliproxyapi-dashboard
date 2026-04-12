/**
 * Formats an ISO date string as relative time until that date.
 * Returns i18n-compatible structured data for the caller to localize.
 */
export interface RelativeTimeResult {
  type: "unknown" | "resetting" | "time";
  days?: number;
  hours?: number;
  minutes?: number;
}

export function parseRelativeTime(isoDate: string | null | undefined): RelativeTimeResult {
  if (!isoDate) return { type: "unknown" };

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return { type: "unknown" };

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return { type: "resetting" };

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { type: "time", days, hours, minutes };
}

/**
 * Format relative time with translations.
 * @param isoDate - ISO date string
 * @param t - Translation function from useTranslations("quota")
 */
export function formatRelativeTime(
  isoDate: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const result = parseRelativeTime(isoDate);

  switch (result.type) {
    case "unknown":
      return t("unknown");
    case "resetting":
      return t("resettingStatus");
    case "time": {
      const { days = 0, hours = 0, minutes = 0 } = result;
      if (days > 0) return t("relativeTimeDaysHours", { days, hours });
      if (hours > 0) return t("relativeTimeHoursMinutes", { hours, minutes });
      return t("relativeTimeMinutes", { minutes });
    }
  }
}
