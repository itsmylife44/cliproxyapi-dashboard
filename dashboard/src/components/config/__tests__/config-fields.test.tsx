import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ROUTING_STRATEGIES } from "@/lib/routing-strategies";
import { Select } from "../config-fields";

const options = ROUTING_STRATEGIES.map((strategy) => ({
  value: strategy.value,
  label: strategy.labelKey,
}));

/** Return the rendered `<option>` tag for a value, if any. */
function optionTagFor(html: string, value: string): string | undefined {
  return html.split("<option").find((chunk) => chunk.includes(`value="${value}"`));
}

describe("Select", () => {
  it("marks the option matching the current value as selected", () => {
    const html = renderToStaticMarkup(
      <Select value="fill-first" onChange={() => {}} options={options} />
    );

    const selected = optionTagFor(html, "fill-first");
    expect(selected).toBeDefined();
    expect(selected).toContain("selected");
  });

  it("renders an unknown current value instead of leaving the control blank", () => {
    // e.g. a strategy set through the CLIProxyAPI control panel that this build
    // no longer offers (or a value removed from the proxy's accepted set).
    const html = renderToStaticMarkup(
      <Select value="random" onChange={() => {}} options={options} />
    );

    const fallback = optionTagFor(html, "random");
    expect(fallback).toBeDefined();
    expect(fallback).toContain("selected");
    // The known options are still offered alongside it.
    expect(optionTagFor(html, "round-robin")).toBeDefined();
    expect(optionTagFor(html, "weighted-round-robin")).toBeDefined();
    expect(optionTagFor(html, "fill-first")).toBeDefined();
  });

  it("does not invent an option for an empty value", () => {
    const html = renderToStaticMarkup(
      <Select value="" onChange={() => {}} options={options} />
    );

    expect(optionTagFor(html, "")).toBeUndefined();
  });
});
