import type { QuotaGroup } from "@/lib/model-first-monitoring";
import { formatWindowLabel } from "@/lib/quota/labels";

// Unofficial Grok CLI subscription endpoint (same one the Grok CLI `/usage` command reads).
export const XAI_BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
export const XAI_BILLING_HEADERS = {
  Authorization: "Bearer $TOKEN$",
  "X-XAI-Token-Auth": "xai-grok-cli",
};

interface XaiCents {
  val?: number;
}

interface XaiUsagePeriod {
  type?: string;
  start?: string;
  end?: string;
}

export interface XaiBillingResponse {
  config?: {
    creditUsagePercent?: number;
    monthlyLimit?: XaiCents;
    used?: XaiCents;
    currentPeriod?: XaiUsagePeriod;
    productUsage?: Array<{ product?: string; usagePercent?: number }>;
  };
}

const clampFraction = (value: number) => Math.max(0, Math.min(1, value));

function usedFraction(config: NonNullable<XaiBillingResponse["config"]>): number | null {
  if (typeof config.creditUsagePercent === "number" && Number.isFinite(config.creditUsagePercent)) return config.creditUsagePercent / 100;
  const used = config.used?.val;
  const limit = config.monthlyLimit?.val;
  if (typeof used === "number" && Number.isFinite(used) && typeof limit === "number" && Number.isFinite(limit) && limit > 0) return used / limit;
  return null;
}

function periodSeconds(period: XaiUsagePeriod | undefined): number | undefined {
  const start = Date.parse(period?.start ?? "");
  const end = Date.parse(period?.end ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 1000 : undefined;
}

/** Turns the Grok subscription billing payload into the shared usage-pool window plus per-product shares. */
export function parseXaiQuota(data: XaiBillingResponse): QuotaGroup[] | null {
  const config = data.config;
  if (!config?.currentPeriod) return null;
  const used = usedFraction(config);
  if (used === null) return null;

  const windowSeconds = periodSeconds(config.currentPeriod);
  const resetTime = config.currentPeriod.end ? new Date(config.currentPeriod.end).toISOString() : null;
  const remainingFraction = clampFraction(1 - used);
  const label = windowSeconds ? formatWindowLabel(windowSeconds) : "Usage Pool";

  const models = (config.productUsage ?? [])
    .filter((entry) => entry.product && typeof entry.usagePercent === "number")
    .map((entry) => ({
      id: `xai-product-${entry.product!.toLowerCase()}`,
      displayName: entry.product!,
      remainingFraction: clampFraction(1 - entry.usagePercent! / 100),
      resetTime,
    }));

  return [
    {
      id: "xai-usage-pool",
      label,
      windowSeconds,
      remainingFraction,
      resetTime,
      models: models.length > 0
        ? models
        : [{ id: "xai-usage-pool", displayName: label, remainingFraction, resetTime }],
    },
  ];
}
