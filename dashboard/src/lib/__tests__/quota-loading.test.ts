import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServer from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { background } = vi.hoisted(() => {
  process.env.MANAGEMENT_API_KEY = "quota-test-key";
  return { background: [] as Promise<unknown>[] };
});
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof NextServer>(),
  after: (callback: () => Promise<unknown>) => { background.push(Promise.resolve().then(callback)); },
}));
vi.mock("@/lib/auth/session", () => ({ verifySession: async () => ({ userId: "test" }) }));
vi.mock("@/lib/management-url", () => ({ getManagementUrl: () => "http://management.test" }));
vi.mock("@/lib/quota/quota-history", () => ({
  recordQuotaSnapshots: async () => 0,
  getAccountsQuotaHistory: async () => ({}),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/quota/route";
import { CACHE_TTL, quotaCache } from "@/lib/cache";


describe("quota background refresh", () => {
  beforeEach(() => {
    quotaCache.invalidateAll();
    background.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("serves the previous quota without waiting for providers and coalesces concurrent refreshes", async () => {
    const previous = { accounts: [], generatedAt: new Date().toISOString() };
    quotaCache.set("quota:all", previous, CACHE_TTL.QUOTA);
    quotaCache.set("quota:previous", previous, CACHE_TTL.QUOTA_PREVIOUS);
    vi.setSystemTime(Date.now() + CACHE_TTL.QUOTA + 1);

    let release!: (response: Response) => void;
    const provider = new Promise<Response>((resolve) => { release = resolve; });
    const fetcher = vi.fn(() => provider);
    vi.stubGlobal("fetch", fetcher);

    const responses = await Promise.all([GET(new NextRequest("http://dashboard.test/api/quota")), GET(new NextRequest("http://dashboard.test/api/quota"))]);
    for (const response of responses) expect(await response.json()).toEqual(previous);
    expect(fetcher).toHaveBeenCalledTimes(1);

    release(Response.json({ files: [] }));
    await Promise.all(background);
    const updated = await (await GET(new NextRequest("http://dashboard.test/api/quota"))).json();
    expect(updated.accounts).toEqual([]);
    expect(Date.parse(updated.generatedAt)).toBeGreaterThan(Date.parse(previous.generatedAt));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
