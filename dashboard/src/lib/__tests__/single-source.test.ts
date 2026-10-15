import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

/** Non-test source files under src/ (excluding generated code), as src-relative paths. */
function sourceFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !f.startsWith("generated") && !/(__tests__|\.test\.tsx?$)/.test(f))
    .map((f) => f.split(path.sep).join("/"));
}

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles()
    .filter((f) => pattern.test(readFileSync(path.join(SRC, f), "utf8")))
    .sort();
}

describe("single sources of truth", () => {
  it("only lib/management-url reads the management URL from the environment", () => {
    expect(filesMatching(/\benv\.CLIPROXYAPI_MANAGEMENT_URL\b/)).toEqual([
      // getProxyUrl: the client-facing proxy URL, deliberately empty when the variable is unset
      "lib/config-generators/opencode.ts",
      "lib/management-url.ts",
      // CLI script: only warns when the variable is missing
      "scripts/migrate-provider-ownership.ts",
    ]);
  });

  it("defines the version-pin error code once", () => {
    expect(filesMatching(/["'`]PROXY_VERSION_PIN_UNAVAILABLE["'`]/)).toEqual(["lib/error-codes.ts"]);
  });
});
