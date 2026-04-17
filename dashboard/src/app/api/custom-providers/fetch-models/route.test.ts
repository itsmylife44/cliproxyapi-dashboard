import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));


vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(() => ({ userId: "test-user" })),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimitWithPreset: vi.fn(() => ({ allowed: true })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const envMock: { ALLOW_LOCAL_PROVIDER_URLS: boolean } = {
  ALLOW_LOCAL_PROVIDER_URLS: false,
};
vi.mock("@/lib/env", () => ({
  get env() {
    return envMock;
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/custom-providers/fetch-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/custom-providers/fetch-models (issue #197)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.ALLOW_LOCAL_PROVIDER_URLS = false;
  });

  it("rejects localhost when flag is off", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://localhost:11434/v1", apiKey: "k" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/private or localhost/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects 127.0.0.1 when flag is off", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://127.0.0.1:11434/v1", apiKey: "k" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows localhost when flag is on", async () => {
    envMock.ALLOW_LOCAL_PROVIDER_URLS = true;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "llama3" }] }),
      body: { cancel: vi.fn() },
    });
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://localhost:11434/v1", apiKey: "k" }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows 127.0.0.1 when flag is on", async () => {
    envMock.ALLOW_LOCAL_PROVIDER_URLS = true;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "llama3" }] }),
      body: { cancel: vi.fn() },
    });
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://127.0.0.1:11434/v1" }));
    expect(res.status).toBe(200);
  });

  it("still blocks cloud metadata (169.254.169.254) when flag is on", async () => {
    envMock.ALLOW_LOCAL_PROVIDER_URLS = true;
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://169.254.169.254/latest/meta-data", apiKey: "k" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still blocks Alibaba metadata (100.100.100.200) when flag is on", async () => {
    envMock.ALLOW_LOCAL_PROVIDER_URLS = true;
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://100.100.100.200/latest/meta-data", apiKey: "k" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits Authorization header when apiKey is missing", async () => {
    envMock.ALLOW_LOCAL_PROVIDER_URLS = true;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "llama3" }] }),
      body: { cancel: vi.fn() },
    });
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://localhost:11434/v1" }));
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("sends Authorization header when apiKey is provided", async () => {
    envMock.ALLOW_LOCAL_PROVIDER_URLS = true;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "llama3" }] }),
      body: { cancel: vi.fn() },
    });
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ baseUrl: "http://localhost:11434/v1", apiKey: "secret" }));
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer secret");
  });
});
