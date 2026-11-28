const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const WINDOW_SECONDS = {
  fiveHours: 5 * HOUR_SECONDS,
  week: 7 * DAY_SECONDS,
  month: 31 * DAY_SECONDS,
} as const;

const SHORT_TERM_MAX_WINDOW_SECONDS = DAY_SECONDS;

/** Windows of a day or less are short-term; unknown durations count as long-term. */
export function isShortTermQuotaWindow(group: { windowSeconds?: number }): boolean {
  return (group.windowSeconds ?? Infinity) <= SHORT_TERM_MAX_WINDOW_SECONDS;
}
