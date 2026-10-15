import { expect } from "vitest";

import { buildOhMyOpenCodeConfig as build } from "@/lib/config-generators/oh-my-opencode";
import { upstreamSchemaErrors } from "./upstream-schema";

/** `buildOhMyOpenCodeConfig` for tests: every generated config must also validate against the vendored OMO schema. */
export function buildOhMyOpenCodeConfig(...args: Parameters<typeof build>): ReturnType<typeof build> {
  const config = build(...args);
  if (config !== null) expect(upstreamSchemaErrors("omo", config)).toEqual([]);
  return config;
}
