/** Lowercase, dash-separated slug used to build stable quota group ids. */
export function slugifyLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Human label for a quota window duration, e.g. `5h Window` or `30m Window`. */
export function formatWindowLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m Window`;
  return `${Math.round(minutes / 60)}h Window`;
}
