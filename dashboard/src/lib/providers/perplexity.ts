export function isPerplexityEnabled(): boolean {
  return Boolean(process.env.PERPLEXITY_SIDECAR_SECRET?.trim());
}
