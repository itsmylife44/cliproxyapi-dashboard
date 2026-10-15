import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfigYaml } from "@/lib/config-yaml";
import { writeConfigYamlChanges } from "@/lib/config-yaml-write";

describe("writeConfigYamlChanges", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads config.yaml, merges the changes and PUTs the result back", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("debug: false\nplugins:\n  dir: /p\n"))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const { step, res } = await writeConfigYamlChanges({ plugins: { enabled: true } });

    expect(step).toBe("write");
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/management/config.yaml");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/management/config.yaml");
    expect(init).toMatchObject({ method: "PUT", headers: { "Content-Type": "text/yaml" } });
    expect(parseConfigYaml(String(init.body))).toEqual({ debug: false, plugins: { dir: "/p", enabled: true } });
  });

  it("stops without writing when config.yaml cannot be read", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("nope", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const { step, res } = await writeConfigYamlChanges({ debug: true });

    expect(step).toBe("read");
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
