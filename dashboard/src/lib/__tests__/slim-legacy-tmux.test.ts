import { describe, expect, it, vi } from "vitest";

import { buildSlimConfig } from "./helpers/slim-schema-guard";
import { validateSlimConfig } from "../config-generators/oh-my-opencode-slim-types";
import { upstreamSchemaErrors } from "./helpers/upstream-schema";

vi.mock("server-only", () => ({}));

function generate(stored: unknown) {
  return buildSlimConfig(["model-a"], validateSlimConfig(stored));
}

describe("slim legacy tmux block", () => {
  it("converts an enabled tmux block into a tmux multiplexer", () => {
    const config = generate({ tmux: { enabled: true, layout: "main-horizontal", main_pane_size: 70 } });

    expect(config?.multiplexer).toEqual({ type: "tmux", layout: "main-horizontal", main_pane_size: 70 });
    expect(config).not.toHaveProperty("tmux");
    expect(upstreamSchemaErrors("slim", config)).toEqual([]);
  });

  it("converts a disabled tmux block into multiplexer type none with defaults", () => {
    const config = generate({ tmux: { enabled: false } });

    expect(config?.multiplexer).toEqual({ type: "none", layout: "main-vertical", main_pane_size: 60 });
    expect(upstreamSchemaErrors("slim", config)).toEqual([]);
  });

  it("falls back to main-vertical for an invalid layout and clamps the pane size", () => {
    const config = generate({ tmux: { enabled: true, layout: "spiral", main_pane_size: 95 } });

    expect(config?.multiplexer).toEqual({ type: "tmux", layout: "main-vertical", main_pane_size: 80 });
  });

  it("keeps a stored multiplexer and ignores tmux", () => {
    const config = generate({
      multiplexer: { type: "zellij", layout: "tiled", main_pane_size: 40 },
      tmux: { enabled: true, layout: "main-horizontal", main_pane_size: 70 },
    });

    expect(config?.multiplexer).toEqual({ type: "zellij", layout: "tiled", main_pane_size: 40 });
    expect(config).not.toHaveProperty("tmux");
  });

  it("never returns tmux from validation", () => {
    const validated = validateSlimConfig({ tmux: { enabled: true, layout: "tiled" } });

    expect(validated).not.toHaveProperty("tmux");
    expect(validated.multiplexer).toEqual({ type: "tmux", layout: "tiled" });
  });
});
