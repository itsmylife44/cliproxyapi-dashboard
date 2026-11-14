"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_COLORS, useChartTheme } from "@/components/ui/chart-theme";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { formatUSD } from "@/lib/model-pricing";
import type { AccountQuotaHistoryResponse, QuotaModelValuation } from "@/lib/quota/quota-history";
import type { QuotaGroup } from "@/lib/model-first-monitoring";
import { normalizeFraction } from "@/lib/model-first-monitoring";
import { cn } from "@/lib/utils";

interface AccountQuotaHistoryProps {
  authIndex: string;
  groups?: QuotaGroup[];
  refreshKey?: string;
}

function formatShortTime(iso: string | number): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EstimateChange({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null || current === previous) return null;
  const difference = current - previous;
  const percent = previous > 0 ? Math.abs(difference / previous * 100) : null;
  return <span className={cn("ml-1 whitespace-nowrap", difference > 0 ? "text-emerald-700" : "text-rose-600")}>({difference > 0 ? "↑" : "↓"} {formatUSD(Math.abs(difference))}{percent === null ? "" : ` · ${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`})</span>;
}

const CLIENT_HISTORY_TTL_MS = 60_000;
const clientHistoryCache = new Map<string, { data: AccountQuotaHistoryResponse; expiresAt: number }>();
const clientHistoryInflight = new Map<string, Promise<AccountQuotaHistoryResponse | null>>();

export function getCachedQuotaHistory(authIndex: string): AccountQuotaHistoryResponse | null {
  const entry = clientHistoryCache.get(authIndex);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    clientHistoryCache.delete(authIndex);
    return null;
  }
  return entry.data;
}

export function prefetchAccountQuotaHistory(authIndex: string, signal?: AbortSignal): Promise<AccountQuotaHistoryResponse | null> {
  const cached = getCachedQuotaHistory(authIndex);
  if (cached) return Promise.resolve(cached);
  const inflight = clientHistoryInflight.get(authIndex);
  if (inflight && !signal) return inflight;

  const request = fetch(`${API_ENDPOINTS.QUOTA.HISTORY}?authIndex=${encodeURIComponent(authIndex)}`, { signal })
    .then((res) => (res.ok ? (res.json() as Promise<AccountQuotaHistoryResponse>) : null))
    .then((json) => {
      if (json) {
        clientHistoryCache.set(authIndex, { data: json, expiresAt: Date.now() + CLIENT_HISTORY_TTL_MS });
      }
      return json;
    })
    .catch(() => null)
    .finally(() => {
      clientHistoryInflight.delete(authIndex);
    });

  if (!signal) {
    clientHistoryInflight.set(authIndex, request);
  }
  return request;
}

export function prefetchBatchQuotaHistory(authIndices: string[], signal?: AbortSignal): Promise<void> {
  const missing = Array.from(new Set(authIndices.filter((id) => id && !getCachedQuotaHistory(id) && !clientHistoryInflight.has(id))));
  if (missing.length === 0) return Promise.resolve();
  if (missing.length === 1) {
    return prefetchAccountQuotaHistory(missing[0]!, signal).then(() => undefined);
  }

  const batchPromise = fetch(`${API_ENDPOINTS.QUOTA.HISTORY}?authIndices=${encodeURIComponent(missing.join(","))}`, { signal })
    .then((res) => (res.ok ? (res.json() as Promise<{ histories?: Record<string, AccountQuotaHistoryResponse> }>) : null))
    .then((json) => {
      const histories = json?.histories ?? {};
      const expiresAt = Date.now() + CLIENT_HISTORY_TTL_MS;
      for (const id of missing) {
        const item = histories[id];
        if (item) {
          clientHistoryCache.set(id, { data: item, expiresAt });
        }
      }
      return histories;
    })
    .catch(() => ({} as Record<string, AccountQuotaHistoryResponse>));

  if (!signal) {
    for (const id of missing) {
      const itemPromise = batchPromise
        .then((histories) => histories[id] ?? null)
        .finally(() => {
          clientHistoryInflight.delete(id);
        });
      clientHistoryInflight.set(id, itemPromise);
    }
  }

  return batchPromise.then(() => undefined);
}

export function invalidateClientQuotaHistoryCache(): void {
  clientHistoryCache.clear();
  clientHistoryInflight.clear();
}

export function AccountQuotaHistory({ authIndex, groups, refreshKey }: AccountQuotaHistoryProps) {
  const t = useTranslations("quota");
  const { axisTickStyle, tooltipStyle, tokens } = useChartTheme();
  const initialCached = getCachedQuotaHistory(authIndex);
  const [data, setData] = useState<AccountQuotaHistoryResponse | null>(initialCached);
  const [loading, setLoading] = useState<boolean>(initialCached === null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(initialCached?.models[0]?.modelId ?? null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groups?.[0]?.id ?? initialCached?.models[0]?.groupId ?? null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      setNow(Date.now());
      void prefetchAccountQuotaHistory(authIndex).then((json) => {
        if (!cancelled && json) {
          setData(json);
          setSelectedModelId((prev) => prev && json.models.some((m) => m.modelId === prev) ? prev : (json.models[0]?.modelId ?? null));
          setSelectedGroupId((prev) => prev && json.models.some((m) => m.groupId === prev) ? prev : null);
        }
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, CLIENT_HISTORY_TTL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authIndex, refreshKey]);

  const windowTable = groups && groups.length > 0 && (
    <div className="mt-3 overflow-x-auto rounded-sm border border-[var(--surface-border)]">
      <table className="w-full min-w-[450px] text-left text-xs">
        <thead className="border-b border-[var(--surface-border)] text-[10px] uppercase text-[var(--text-muted)]">
          <tr><th className="px-3 py-2">{t("quotaGroupColumnLabel")}</th><th>{t("remainingColumnLabel")}</th><th>{t("estRemainingLabel")} / {t("estFullWindowLabel")}</th><th>{t("resetColumnLabel")}</th></tr>
        </thead>
        <tbody>{groups.map((group) => {
          const fraction = normalizeFraction(group.remainingFraction);
          const valuation = data?.windows[group.id];
          return <tr key={group.id} className="border-b border-[var(--surface-border)] last:border-0">
            <td className="px-3 py-2">{group.label}</td>
            <td>{fraction === null ? "—" : `${Math.round(fraction * 100)}%`}</td>
            <td title={t("quotaEstimateNote")}>{fraction !== null && valuation?.estimatedFullWindowUsd != null ? <>{formatUSD(fraction * valuation.estimatedFullWindowUsd)} / {formatUSD(valuation.estimatedFullWindowUsd)}<EstimateChange current={valuation.estimatedFullWindowUsd} previous={valuation.previousEstimatedFullWindowUsd} /></> : "—"}</td>
            <td>{formatRelativeTime(group.resetTime, t)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );

  if (loading || !data || data.models.length === 0) {
    return <>{windowTable}<div className="mt-3 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)]/30 p-3 text-xs text-[var(--text-muted)]">{loading ? t("loadingHistory") : t("noHistoryYet")}</div></>;
  }

  const rawGroupIds = Array.from(new Set(data.models.map((model) => model.groupId)));
  const groupIds = [
    ...(groups?.map((g) => g.id).filter((id) => rawGroupIds.includes(id)) ?? []),
    ...rawGroupIds.filter((id) => !groups?.some((g) => g.id === id)),
  ];
  const activeGroupId = selectedGroupId && groupIds.includes(selectedGroupId) ? selectedGroupId : groupIds[0]!;
  const visibleModels = data.models.filter((model) => model.groupId === activeGroupId);
  const selectedModel: QuotaModelValuation = visibleModels.find((model) => model.modelId === selectedModelId) ?? visibleModels[0]!;

  const cutoff = now - 24 * 60 * 60 * 1000;
  const chartData = selectedModel.series.flatMap((pt) => {
    const time = Date.parse(pt.timestamp);
    return time >= cutoff && time <= now ? [{
      time,
      remainingPct: pt.remainingPct,
      estimatedRemainingUsd: pt.estimatedRemainingUsd,
    }] : [];
  });
  const selectedGroup = groups?.find((group) => group.id === selectedModel.groupId);
  const selectedFraction = selectedGroup ? normalizeFraction(selectedGroup.remainingFraction) : null;
  const selectedRemainingUsd = selectedFraction !== null && selectedModel.estimatedFullWindowUsd !== null
    ? selectedFraction * selectedModel.estimatedFullWindowUsd : selectedModel.estimatedRemainingUsd;

  const hasUsdSeries = selectedModel.estimatedFullWindowUsd !== null;

  return (
    <>{windowTable}<div className="mt-3 space-y-2.5 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("quotaGroupColumnLabel")}>
        {groupIds.map((id) => <button type="button" key={id} aria-pressed={activeGroupId === id} onClick={() => { setSelectedGroupId(id); setSelectedModelId(null); }} className={cn("rounded px-3 py-1.5 text-xs", activeGroupId === id ? "bg-[var(--surface-muted)] font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]")}>{groups?.find((group) => group.id === id)?.label ?? id}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {t("quotaHistoryTitle")} · <span className="font-mono text-[var(--text-primary)]">{selectedModel.modelId} · {selectedModel.groupId}</span>
        </span>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span>
            {t("estRemainingLabel")}: {" "}
            <strong className="font-semibold text-[var(--text-primary)]">
              {selectedRemainingUsd !== null ? formatUSD(selectedRemainingUsd) : "\u2014"}
            </strong>
          </span>
          <span>
            {t("estFullWindowLabel")}: {" "}
            <strong className="font-semibold text-[var(--text-primary)]">
              {selectedModel.estimatedFullWindowUsd !== null ? formatUSD(selectedModel.estimatedFullWindowUsd) : "\u2014"}
            </strong>
            <EstimateChange current={selectedModel.estimatedFullWindowUsd} previous={selectedModel.previousEstimatedFullWindowUsd} />
          </span>
        </div>
      </div>

      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 320, height: 144 }}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <XAxis
              dataKey="time"
              type="number"
              domain={[cutoff, now]}
              tickFormatter={formatShortTime}
              tick={{ ...axisTickStyle, fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: tokens.border }}
              minTickGap={28}
            />
            <YAxis
              yAxisId="pct"
              domain={[0, 100]}
              tick={axisTickStyle}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            {hasUsdSeries ? (
              <YAxis
                yAxisId="usd"
                orientation="right"
                tick={axisTickStyle}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatUSD(Number(v))}
              />
            ) : null}
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(value) => formatShortTime(Number(value))}
              formatter={(value, name) => {
                if (name === "estimatedRemainingUsd") {
                  return [value !== null && value !== undefined ? formatUSD(Number(value)) : "\u2014", t("estRemainingLabel")];
                }
                return [`${value}%`, t("remainingColumnLabel")];
              }}
            />
            <Area
              yAxisId="pct"
              type="monotone"
              dataKey="remainingPct"
              stroke={CHART_COLORS.cyan}
              fill={CHART_COLORS.cyan}
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
            />
            {hasUsdSeries ? (
              <Area
                yAxisId="usd"
                type="monotone"
                dataKey="estimatedRemainingUsd"
                stroke={CHART_COLORS.success}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-sm border border-[var(--surface-border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <th className="px-2.5 py-1.5 text-left">{t("modelColumnLabel")}</th>
              <th className="px-2.5 py-1.5 text-right">{t("remainingColumnLabel")}</th>
              <th className="px-2.5 py-1.5 text-right">{t("estRemainingLabel")}</th>
              <th className="px-2.5 py-1.5 text-right">{t("estFullWindowLabel")}</th>
              <th className="px-2.5 py-1.5 text-right">{t("resetColumnLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleModels.map((model) => {
              const isSelected = model.modelId === selectedModel.modelId;
              const group = groups?.find((item) => item.id === model.groupId);
              const fraction = group ? normalizeFraction(group.remainingFraction) : null;
              const remainingPct = fraction !== null ? Math.round(fraction * 1000) / 10 : model.currentRemainingPct;
              const remainingUsd = fraction !== null && model.estimatedFullWindowUsd !== null
                ? fraction * model.estimatedFullWindowUsd : model.estimatedRemainingUsd;
              return (
                <tr
                  key={model.modelId}
                  onClick={() => setSelectedModelId(model.modelId)}
                  className={cn(
                    "cursor-pointer border-b border-[var(--surface-border)]/60 last:border-b-0 transition-colors",
                    isSelected ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-hover)]"
                  )}
                >
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-[var(--text-primary)]">{model.modelId}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {remainingPct !== null ? `${remainingPct}%` : "\u2014"}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {remainingUsd !== null ? formatUSD(remainingUsd) : "\u2014"}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {model.estimatedFullWindowUsd !== null ? formatUSD(model.estimatedFullWindowUsd) : "\u2014"}
                    <EstimateChange current={model.estimatedFullWindowUsd} previous={model.previousEstimatedFullWindowUsd} />
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-[var(--text-muted)]">
                    {formatRelativeTime(group ? group.resetTime : model.resetTime, t)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div></>
  );
}
