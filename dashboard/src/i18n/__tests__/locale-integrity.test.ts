import { describe, it, expect } from "vitest";
import en from "../../../messages/en.json";
import de from "../../../messages/de.json";
import es from "../../../messages/es.json";
import zhCN from "../../../messages/zh-CN.json";

function flatEntries(obj: object, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]): [string, string][] =>
    v && typeof v === "object" ? flatEntries(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
  );
}

const flatKeys = (obj: object) => flatEntries(obj).map(([k]) => k).sort();

const locales = { de, es, "zh-CN": zhCN };

describe.each(Object.entries(locales))("%s", (_, messages) => {
  // src/i18n has no English fallback, so a key missing in a locale renders as its raw path.
  it("has exactly the keys of en.json", () => {
    expect(flatKeys(messages)).toEqual(flatKeys(en));
  });
});

describe.each(Object.entries({ en, ...locales }))("%s", (_, messages) => {
  // UTF-8 read as Windows-1252 starts each character with Â, Ã or â:
  // "·" becomes "Â·", "…" becomes "â€¦", "→" becomes "â†’". No locale uses these letters.
  it("has no double-encoded UTF-8", () => {
    expect(flatEntries(messages).filter(([, v]) => /[ÂÃâ]/.test(v))).toEqual([]);
  });
});
