export const THEME_STORAGE_KEY = "theme" as const;
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isValidTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}
