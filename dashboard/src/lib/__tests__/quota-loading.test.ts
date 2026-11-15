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

import { NextRequest } from "next/server";
import { GET } from "@/app/api/quota/route";
import { CACHE_TTL, quotaAccountCache, quotaCache } from "@/lib/cache";

describe("quota background refresh", () => {
  beforeEach(() => {
    quotaCache.invalidateAll();
    quotaAccountCache.invalidateAll();
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

    const responses = await Promise.all([
      GET(new NextRequest("http://dashboard.test/api/quota")),
      GET(new NextRequest("http://dashboard.test/api/quota")),
    ]);
    for (const response of responses) expect(await response.json()).toEqual(previous);
    expect(fetcher).toHaveBeenCalledTimes(1);

    release(Response.json({ files: [] }));
    await Promise.all(background);
    const updated = await (await GET(new NextRequest("http://dashboard.test/api/quota"))).json();
    expect(updated.accounts).toEqual([]);
    expect(Date.parse(updated.generatedAt)).toBeGreaterThan(Date.parse(previous.generatedAt));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not serve stale quota:previous to internal alert-check calls", async () => {
    const previous = { accounts: [], generatedAt: new Date().toISOString() };
    quotaCache.set("quota:all", previous, CACHE_TTL.QUOTA);
    quotaCache.set("quota:previous", previous, CACHE_TTL.QUOTA_PREVIOUS);
    vi.setSystemTime(Date.now() + CACHE_TTL.QUOTA + 1);

    const fetcher = vi.fn(async () => Response.json({ files: [] }));
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(
      new NextRequest("http://dashboard.test/api/quota", {
        headers: { "x-internal-key": "quota-test-key" },
      })
    );
    const body = await response.json();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(Date.parse(body.generatedAt)).toBeGreaterThan(Date.parse(previous.generatedAt));
  });

  it("does not join an in-flight non-bust refresh when bust=1 is requested", async () => {
    let releaseNonBust!: (response: Response) => void;
    let releaseBust!: (response: Response) => void;
    const nonBustPromise = new Promise<Response>((resolve) => { releaseNonBust = resolve; });
    const bustPromise = new Promise<Response>((resolve) => { releaseBust = resolve; });

    const fetcher = vi
      .fn()
      .mockReturnValueOnce(nonBustPromise)
      .mockReturnValueOnce(bustPromise);
    vi.stubGlobal("fetch", fetcher);

    const nonBustReq = GET(new NextRequest("http://dashboard.test/api/quota"));
    const bustReq = GET(new NextRequest("http://dashboard.test/api/quota?bust=1"));
    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    releaseBust(Response.json({ files: [] }));
    releaseNonBust(Response.json({ files: [] }));

    const [nonBustRes, bustRes] = await Promise.all([nonBustReq, bustReq]);
    expect(nonBustRes.status).toBe(200);
    expect(bustRes.status).toBe(200);
  });

  it("does not evict quota:all or quota:previous when per-account cache fills", () => {
    const allPayload = { accounts: [], generatedAt: new Date().toISOString() };
    quotaCache.set("quota:all", allPayload, CACHE_TTL.QUOTA);
    quotaCache.set("quota:previous", allPayload, CACHE_TTL.QUOTA_PREVIOUS);

    for (let i = 0; i < 150; i++) {
      quotaAccountCache.set(`quota:account:${i}`, { auth_index: String(i) }, CACHE_TTL.QUOTA_ACCOUNT);
    }

    expect(quotaCache.get("quota:all")).toEqual(allPayload);
    expect(quotaCache.get("quota:previous")).toEqual(allPayload);
  });
});
