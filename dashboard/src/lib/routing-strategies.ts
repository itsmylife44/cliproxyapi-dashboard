/**
 * Load-balancing strategies accepted by CLIProxyAPI's
 * `PUT /v0/management/routing/strategy` endpoint.
 *
 * The proxy rejects anything outside this set with `invalid strategy`, so the
 * config editor must only offer these values. `labelKey` maps to the
 * `agentConfig` translation namespace.
 */
export const ROUTING_STRATEGIES = [
  { value: "round-robin", labelKey: "routingRoundRobin" },
  { value: "weighted-round-robin", labelKey: "routingWeightedRoundRobin" },
  { value: "fill-first", labelKey: "routingFillFirst" },
] as const;
