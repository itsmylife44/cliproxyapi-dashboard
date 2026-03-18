import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDismissedIds,
  addDismissedId,
  filterNotifications,
  DISMISSED_KEY_PREFIX,
  MAX_DISMISSED,
} from "../notification-dismissal";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe("getDismissedIds", () => {
  it("returns empty set when no storage", () => {
    const result = getDismissedIds("user123");
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it("scopes by userId — user A dismissed IDs do not appear for user B", () => {
    addDismissedId("userA", "id-shared");
    const resultB = getDismissedIds("userB");
    expect(resultB.has("id-shared")).toBe(false);
  });

  it("returns stored IDs for the correct user", () => {
    addDismissedId("user123", "health-db");
    addDismissedId("user123", "health-proxy");
    const result = getDismissedIds("user123");
    expect(result.has("health-db")).toBe(true);
    expect(result.has("health-proxy")).toBe(true);
  });
});

describe("addDismissedId", () => {
  it("persists to correct user-scoped key", () => {
    addDismissedId("userId123", "health-db");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${DISMISSED_KEY_PREFIX}userId123`,
      expect.any(String)
    );
    const callArgs = localStorageMock.setItem.mock.calls[0];
    expect(callArgs[0]).toBe("header_notifications_dismissed_userId123");
  });

  it("caps at MAX_DISMISSED entries, evicts oldest", () => {
    for (let i = 0; i <= MAX_DISMISSED; i++) {
      addDismissedId("userCap", `id-${i}`);
    }
    const result = getDismissedIds("userCap");
    expect(result.size).toBe(MAX_DISMISSED);
    expect(result.has("id-0")).toBe(false);
    expect(result.has(`id-${MAX_DISMISSED}`)).toBe(true);
  });

  it("does not duplicate IDs", () => {
    addDismissedId("user123", "health-db");
    addDismissedId("user123", "health-db");
    const result = getDismissedIds("user123");
    expect(result.size).toBe(1);
  });
});

describe("filterNotifications", () => {
  it("dismissed IDs filter reduces notification count", () => {
    const notifications = [
      { id: "health-db", message: "DB down" },
      { id: "health-proxy", message: "Proxy down" },
      { id: "update-dashboard", message: "Update available" },
    ];
    const dismissedIds = new Set(["health-db", "health-proxy"]);
    const result = filterNotifications(notifications, dismissedIds);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("update-dashboard");
  });

  it("returns all notifications when dismissed set is empty", () => {
    const notifications = [
      { id: "health-db", message: "DB down" },
      { id: "update-dashboard", message: "Update available" },
    ];
    const result = filterNotifications(notifications, new Set());
    expect(result.length).toBe(2);
  });
});

describe("per-user isolation", () => {
  it("dismissed by userA not visible for userB", () => {
    addDismissedId("userA", "id-x");
    const resultA = getDismissedIds("userA");
    const resultB = getDismissedIds("userB");
    expect(resultA.has("id-x")).toBe(true);
    expect(resultB.has("id-x")).toBe(false);
  });

  it("each user has independent storage keys", () => {
    addDismissedId("userA", "notif-1");
    addDismissedId("userB", "notif-2");

    const resultA = getDismissedIds("userA");
    const resultB = getDismissedIds("userB");

    expect(resultA.has("notif-1")).toBe(true);
    expect(resultA.has("notif-2")).toBe(false);
    expect(resultB.has("notif-2")).toBe(true);
    expect(resultB.has("notif-1")).toBe(false);
  });
});
