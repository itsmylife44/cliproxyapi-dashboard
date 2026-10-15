export const DISMISSED_KEY_PREFIX = "header_notifications_dismissed_";
export const MAX_DISMISSED = 100;

export function getDismissedIds(userId: string): Set<string> {
  // Guard inside try: reading the localStorage global throws when site data is blocked.
  try {
    if (typeof localStorage === "undefined") return new Set();
    const raw = localStorage.getItem(DISMISSED_KEY_PREFIX + userId);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function addDismissedId(userId: string, notificationId: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    const existing = [...getDismissedIds(userId)];
    // Add new ID, deduplicate, cap at MAX_DISMISSED (keep most recent)
    const updated = [...new Set([...existing, notificationId])];
    const capped =
      updated.length > MAX_DISMISSED
        ? updated.slice(updated.length - MAX_DISMISSED)
        : updated;
    localStorage.setItem(DISMISSED_KEY_PREFIX + userId, JSON.stringify(capped));
  } catch {
    // localStorage not available
  }
}

export function filterNotifications<T extends { id: string }>(
  notifications: T[],
  dismissedIds: Set<string>
): T[] {
  return notifications.filter((n) => !dismissedIds.has(n.id));
}
