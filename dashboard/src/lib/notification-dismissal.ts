export const DISMISSED_KEY_PREFIX = "header_notifications_dismissed_";
export const MAX_DISMISSED = 100;

export function getDismissedIds(userId: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY_PREFIX + userId);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function addDismissedId(userId: string, notificationId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
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
