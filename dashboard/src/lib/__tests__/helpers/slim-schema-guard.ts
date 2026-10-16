import { expect } from "vitest";

import { buildSlimConfig as build } from "@/lib/config-generators/oh-my-opencode-slim";
import type { OhMyOpenCodeSlimFullConfig, SlimAgentConfig } from "@/lib/config-generators/oh-my-opencode-slim-types";
import { upstreamSchemaErrors } from "./upstream-schema";

/** `buildSlimConfig` for tests: every generated config must also validate against the vendored slim schema. */
export function buildSlimConfigChecked(...args: Parameters<typeof build>): ReturnType<typeof build> {
  const config = build(...args);
  if (config !== null) expect(upstreamSchemaErrors("slim", config)).toEqual([]);
  return config;
}

/** The generated config: presets are emitted flat (`{ extends?, ...agents }`), unlike the overrides. */
export type GeneratedSlimConfig = Omit<OhMyOpenCodeSlimFullConfig, "presets"> & {
  presets?: Record<string, Record<string, SlimAgentConfig>>;
};
