import { describe, it, expect } from "vitest";
import { parseRepoDigest } from "../containers";

const REPO = "eceasy/cli-proxy-api";

describe("parseRepoDigest", () => {
  it("returns the sha256 of the entry for the requested repo among several", () => {
    const json = JSON.stringify([
      "mirror.example.com/other/image@sha256:aaaa",
      "eceasy/cli-proxy-api@sha256:bbbb",
    ]);
    expect(parseRepoDigest(json, REPO)).toBe("sha256:bbbb");
  });

  it("matches registry-qualified repo names", () => {
    expect(parseRepoDigest('["docker.io/eceasy/cli-proxy-api@sha256:cccc"]', REPO)).toBe("sha256:cccc");
  });

  it("ignores other repos and other registries", () => {
    const json = JSON.stringify([
      "noteceasy/cli-proxy-api@sha256:dddd",
      "ghcr.io/eceasy/cli-proxy-api@sha256:eeee",
    ]);
    expect(parseRepoDigest(json, REPO)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(parseRepoDigest("[]", REPO)).toBeNull();
  });

  it("returns null for null or malformed JSON", () => {
    expect(parseRepoDigest("null", REPO)).toBeNull();
    expect(parseRepoDigest("not json", REPO)).toBeNull();
  });
});
