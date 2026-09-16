import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = fileURLToPath(new URL("../../../messages", import.meta.url));

describe("cost estimation disclaimers", () => {
  it("states the long-context limitation in every locale", () => {
    const localeFiles = readdirSync(MESSAGES_DIR).filter((file) => file.endsWith(".json"));
    expect(localeFiles.length).toBeGreaterThan(0);

    for (const localeFile of localeFiles) {
      const messages = JSON.parse(readFileSync(`${MESSAGES_DIR}/${localeFile}`, "utf8")) as {
        usage: Record<string, string>;
      };

      for (const key of ["costDisclaimerPart1", "costDisclaimerPart2", "costDisclaimerPart3"]) {
        expect(
          messages.usage[key],
          `${localeFile} is missing usage.${key}`
        ).toBeTruthy();
      }
    }
  });
});
