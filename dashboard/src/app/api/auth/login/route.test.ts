import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const createSessionMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({ createSession: createSessionMock }));
vi.mock("@/lib/auth/dal", () => ({
  getUserByUsername: vi.fn().mockResolvedValue({
    id: "user-1",
    username: "victim",
    passwordHash: "hash",
    sessionVersion: 0,
  }),
}));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/auth/jwt", () => ({ signToken: vi.fn().mockResolvedValue("token") }));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
}));
vi.mock("@/lib/audit", () => ({ AUDIT_ACTION: { USER_LOGIN: "USER_LOGIN" }, logAuditAsync: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("POST /api/auth/login", () => {
  it("rejects a cross-site Origin with 403 and creates no session", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://dashboard.local/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "text/plain" },
      body: JSON.stringify({ username: "victim", password: "correct-password" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
