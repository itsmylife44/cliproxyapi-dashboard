import { describe, it, expect } from "vitest";
import path from "path";
import { pathToFileURL } from "url";
import en from "../../../messages/en.json";
import de from "../../../messages/de.json";
import es from "../../../messages/es.json";
import zhCN from "../../../messages/zh-CN.json";
import type { AbstractIntlMessages } from "use-intl/core";

type UseIntlCore = typeof import("use-intl/core");

// use-intl ships separate development and production builds; the production
// build skips ICU compilation for t(key) with no values, so test both.
async function loadBuild(build: "development" | "production"): Promise<UseIntlCore> {
  const file = path.resolve(__dirname, `../../../node_modules/use-intl/dist/esm/${build}/core.js`);
  return import(pathToFileURL(file).href);
}

const locales: Record<string, AbstractIntlMessages> = { en, de, es, "zh-CN": zhCN };

const cases = [
  // ICU quotes must be consumed, not rendered: ' {"key": "value"}.' in every locale.
  { key: "settings.plugins.configErrors.notObject", matches: / \{"key": "value"\}[.。]$/ },
  {
    key: "settings.telegram.setupOcxProfilePath",
    equals: "~/.config/opencode/profiles/[profilename]/opencode-cliproxyapi-sync/config.json",
  },
] as const;

describe.each(["development", "production"] as const)("ICU messages (%s build)", (build) => {
  describe.each(Object.entries(locales))("%s", (locale, messages) => {
    it.each(cases)("$key formats with and without values", async ({ key, ...expected }) => {
      const { createTranslator } = await loadBuild(build);
      const errors: unknown[] = [];
      // Keys are checked against the app's global message type, so loosen it here.
      const t = createTranslator({ locale, messages, onError: (e) => errors.push(e) }) as unknown as (
        key: string,
        values?: object,
      ) => string;

      for (const out of [t(key), t(key, {})]) {
        if ("equals" in expected) expect(out).toBe(expected.equals);
        else expect(out).toMatch(expected.matches);
      }
      expect(errors).toEqual([]);
    });
  });
});
