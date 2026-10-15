import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../../messages/en.json";
import type { PluginConfigField } from "@/lib/plugin-config";
import { PluginConfigForm } from "../plugin-config-form";

const field = (name: string, type: PluginConfigField["type"], extra: Partial<PluginConfigField> = {}): PluginConfigField => ({
  name,
  type,
  default: undefined,
  enumValues: [],
  description: "",
  ...extra,
});

function render(fields: PluginConfigField[], config: Record<string, unknown>): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <PluginConfigForm fields={fields} config={config} busy={false} onSave={() => {}} onCancel={() => {}} />
    </NextIntlClientProvider>
  );
}

describe("PluginConfigForm", () => {
  it("renders every field type prefilled from the plugin's config", () => {
    const html = render(
      [
        field("base_url", "string", { description: "Upstream URL" }),
        field("retries", "integer", { default: 3 }),
        field("debug", "boolean"),
        field("mode", "enum", { enumValues: ["fast", "slow"] }),
        field("models", "array"),
        field("headers", "object"),
      ],
      { enabled: true, base_url: "https://proxy.internal", debug: true, mode: "slow", models: ["a"], headers: { k: "v" } }
    );

    expect(html).toContain('value="https://proxy.internal"');
    expect(html).toContain("Upstream URL");
    expect(html).toContain('value="3"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toMatch(/<option value="slow"[^>]*selected=""/);
    expect(html).toContain("[\n  &quot;a&quot;\n]</textarea>");
    expect(html).toContain("{\n  &quot;k&quot;: &quot;v&quot;\n}</textarea>");
    expect(html).toContain("Save settings");
  });

  it("renders nothing for a plugin without settings", () => {
    expect(render([], { enabled: true })).toBe("");
  });
});
