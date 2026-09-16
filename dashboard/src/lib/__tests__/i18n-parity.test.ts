import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = join(process.cwd(), "messages");

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const localeFiles = readdirSync(MESSAGES_DIR).filter((name) => name.endsWith(".json"));
const locales = new Map(
  localeFiles.map((name) => [
    name.replace(/\.json$/, ""),
    flatten(JSON.parse(readFileSync(join(MESSAGES_DIR, name), "utf8"))),
  ]),
);

describe("i18n parity", () => {
  it("has at least the expected locales", () => {
    expect([...locales.keys()].sort()).toEqual(["de", "en", "es", "zh-CN"]);
  });

  it("gives every locale exactly the same key set as en", () => {
    const reference = new Set(locales.get("en"));
    expect(reference.size).toBeGreaterThan(0);

    for (const [locale, keys] of locales) {
      const missing = [...reference].filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !reference.has(key));

      expect(missing, `${locale} is missing keys`).toEqual([]);
      expect(extra, `${locale} has keys en does not`).toEqual([]);
    }
  });

  it("declares no duplicate keys per locale", () => {
    for (const [locale, keys] of locales) {
      expect(new Set(keys).size, `${locale} has duplicate keys`).toBe(keys.length);
    }
  });

  it("keeps the slim namespace free of removed upstream identifiers", () => {
    const stale = ["cartography", "council-master", "agent-browser", "websearch provider"];

    for (const [locale, keys] of locales) {
      const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8");
      const slim = JSON.parse(raw).ohMyOpenCodeSlim as Record<string, string>;
      const slimText = JSON.stringify(slim).toLowerCase();

      for (const term of stale) {
        expect(slimText, `${locale} slim namespace mentions ${term}`).not.toContain(term);
      }
      expect(keys.length).toBeGreaterThan(0);
    }
  });
});
