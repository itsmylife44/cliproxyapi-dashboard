import { describe, expect, it } from "vitest";

import { buildSlimConfigChecked } from "./helpers/slim-schema-guard";
import {
  OMO_PLUGIN,
  resolvePluginList,
  shouldShowOmoSettingsNotice,
  SLIM_PLUGIN,
  SYNC_PLUGIN,
} from "../config-generators/upstream/plugins";

describe("pinned plugin entries", () => {
  it("pins OMO and slim but keeps the sync plugin on @latest", () => {
    expect(OMO_PLUGIN).toBe("oh-my-openagent@5.1.33");
    expect(SLIM_PLUGIN).toBe("oh-my-opencode-slim@3.0.4");
    expect(SYNC_PLUGIN).toBe("opencode-cliproxyapi-sync@latest");
  });
});

describe("generated $schema URLs", () => {
  it("slim config points at the pinned unpkg version", () => {
    expect(buildSlimConfigChecked(["gpt-5.4"])?.$schema).toBe(
      "https://unpkg.com/oh-my-opencode-slim@3.0.4/oh-my-opencode-slim.schema.json",
    );
  });
});

describe("resolvePluginList (sync bundle)", () => {
  it("defaults to the sync plugin and pinned OMO", () => {
    expect(resolvePluginList([])).toEqual([OMO_PLUGIN, SYNC_PLUGIN]);
  });

  it("detects slim from a pinned entry", () => {
    expect(resolvePluginList([SYNC_PLUGIN, SLIM_PLUGIN])).toEqual([SLIM_PLUGIN, SYNC_PLUGIN]);
  });

  it("detects slim stored as @latest and pins it", () => {
    expect(resolvePluginList(["opencode-cliproxyapi-sync@latest", "oh-my-opencode-slim@latest"])).toEqual([
      SLIM_PLUGIN,
      SYNC_PLUGIN,
    ]);
  });

  it("pins a stored OMO @latest entry and keeps other custom plugins", () => {
    expect(resolvePluginList(["oh-my-openagent@latest", "@acme/opencode-plugin@1.2.0"])).toEqual([
      "@acme/opencode-plugin@1.2.0",
      OMO_PLUGIN,
      SYNC_PLUGIN,
    ]);
  });
});

describe("shouldShowOmoSettingsNotice", () => {
  it("shows for sync users on OMO, including the default plugin list", () => {
    expect(shouldShowOmoSettingsNotice(undefined, true)).toBe(true);
    expect(shouldShowOmoSettingsNotice(["oh-my-openagent@latest"], true)).toBe(true);
  });

  it("hides for slim users and for users without a sync token", () => {
    expect(shouldShowOmoSettingsNotice(["oh-my-opencode-slim@latest"], true)).toBe(false);
    expect(shouldShowOmoSettingsNotice([], false)).toBe(false);
  });
});
