"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatCompact } from "@/components/ui/chart-theme";
import {
  calculateTieredCost,
  formatUSD,
  isLongContextPrompt,
  isPeakRequest,
  loadCustomPricing,
  resolveModelPrice,
  splitCachedInput,
  type ModelPrice,
} from "@/lib/model-pricing";

export interface RequestEvent {
  id?: string;
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  cacheWrite1hTokens?: number;
  failed: boolean;
  failureStatus?: number | null;
  failureCode?: string | null;
  failureBody?: string | null;
  cancelled?: boolean;
}

interface UsageRequestEventsProps {
  events?: RequestEvent[];
  isAdmin: boolean;
  livePricing?: Record<string, ModelPrice>;
}

function formatRelativeTime(
  timestamp: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  return t("daysAgo", { count: Math.floor(hours / 24) });
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLatencyClasses(latencyMs: number): string {
  if (latencyMs <= 0) return "border-[var(--surface-border)] bg-[var(--surface-muted)]/70 text-[var(--text-muted)]";
  if (latencyMs < 1000) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (latencyMs < 5000) return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  return "border-rose-500/20 bg-rose-500/10 text-rose-600";
}

function formatLatency(latencyMs: number): string {
  if (latencyMs <= 0) return "\u2014";
  return `${latencyMs.toLocaleString()} ms`;
}

function getStatusBadgeClasses(isCancelled: boolean, failed: boolean): string {
  if (isCancelled) return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  if (failed) return "border-rose-500/20 bg-rose-500/10 text-rose-600";
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
}

function getRowClasses(isCancelled: boolean, failed: boolean): string {
  if (isCancelled) return "bg-amber-500/[0.03] hover:bg-amber-500/[0.07]";
  if (failed) return "bg-rose-500/[0.03] hover:bg-rose-500/[0.07]";
  return "hover:bg-[var(--surface-muted)]";
}

function estimateEventCost(
  event: RequestEvent,
  price: ModelPrice | null,
): number | null {
  if (!price) return null;
  const bucket = {
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    cachedTokens: event.cachedTokens ?? 0,
    cacheWriteTokens: event.cacheWriteTokens ?? 0,
    cacheWrite1hTokens: event.cacheWrite1hTokens ?? 0,
  };
  const empty = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  if (isLongContextPrompt(event.inputTokens, price)) {
    return calculateTieredCost(empty, bucket, price);
  }
  if (isPeakRequest(new Date(event.timestamp), price)) {
    return calculateTieredCost(empty, empty, price, bucket);
  }
  return calculateTieredCost(bucket, empty, price);
}

export function UsageRequestEvents({ events, isAdmin, livePricing }: UsageRequestEventsProps) {
  const t = useTranslations("usage");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const customPricing = useMemo(() => loadCustomPricing(), []);

  const safeEvents = useMemo(() => events ?? [], [events]);
  const hasMissingLatency = safeEvents.some((event) => event.latencyMs <= 0);
  const hasCacheWrites = safeEvents.some((event) => (event.cacheWriteTokens ?? 0) > 0);
  const colCount = (isAdmin ? 10 : 9) + (hasCacheWrites ? 1 : 0);

  const rows = useMemo(
    () =>
      safeEvents.map((event) => {
        const rowKey = event.id ?? `${event.timestamp}-${event.keyName}-${event.model}`;
        const isCancelled = Boolean(event.cancelled);
        const statusSuffix = event.failureStatus ? ` \u00B7 ${event.failureStatus}` : "";
        const statusLabel = isCancelled
          ? `${t("cancelled")}${statusSuffix}`
          : event.failed
            ? `${t("failed")}${statusSuffix}`
            : t("success");
        const price = resolveModelPrice(event.model, customPricing, livePricing);
        const shown = price
          ? splitCachedInput(event.inputTokens, event.cachedTokens ?? 0, price)
          : { uncachedInput: event.inputTokens, cached: event.cachedTokens ?? 0 };
        return {
          event,
          rowKey,
          isExpandable: event.failed,
          isCancelled,
          statusLabel,
          hasDetails: Boolean(event.failureStatus || event.failureCode || event.failureBody),
          shown,
          estCost: estimateEventCost(event, price),
        };
      }),
    [safeEvents, customPricing, livePricing, t]
  );

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const renderStatusBadge = (
    rowKey: string,
    isExpandable: boolean,
    isExpanded: boolean,
    isCancelled: boolean,
    failed: boolean,
    statusLabel: string
  ) =>
    isExpandable ? (
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => toggleRow(rowKey)}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getStatusBadgeClasses(isCancelled, failed)}`}
      >
        <span aria-hidden="true" className="text-[9px]">{isExpanded ? "\u25BC" : "\u25B6"}</span>
        {statusLabel}
      </button>
    ) : (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getStatusBadgeClasses(isCancelled, failed)}`}
      >
        {statusLabel}
      </span>
    );

  const renderFailureDetails = (event: RequestEvent, hasDetails: boolean) =>
    hasDetails ? (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
          {event.failureStatus ? (
            <span>
              <strong className="font-semibold text-[var(--text-primary)]">{t("errorStatusLabel")}:</strong>{" "}
              <span className="font-mono">{event.failureStatus}</span>
            </span>
          ) : null}
          {event.failureCode ? (
            <span>
              <strong className="font-semibold text-[var(--text-primary)]">{t("errorCodeLabel")}:</strong>{" "}
              <span className="font-mono">{event.failureCode}</span>
            </span>
          ) : null}
        </div>
        {event.failureBody ? (
          <pre
            tabIndex={0}
            className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--surface-border)] bg-[var(--surface-base)] p-2 font-mono text-[11px] text-[var(--text-secondary)]"
          >
            {event.failureBody}
          </pre>
        ) : null}
      </div>
    ) : (
      <p className="text-[11px] text-[var(--text-muted)]">{t("errorDetailsUnavailable")}</p>
    );

  if (safeEvents.length === 0) {
    return (
      <section className="py-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">{t("noEventsFound")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)]">
            {t("showingMostRecent", { count: safeEvents.length })}
          </p>
        </div>
        {hasMissingLatency ? (
          <p className="text-[11px] text-[var(--text-muted)]">{t("latencyNotAvailableNote")}</p>
        ) : null}
      </div>

      {/* Responsive Event Feed (Mobile / Tablet, no horizontal scroll) */}
      <div className="divide-y divide-[var(--surface-border)] border-t border-b border-[var(--surface-border)] lg:hidden">
        {rows.map(({ event, rowKey, isExpandable, isCancelled, statusLabel, hasDetails, shown, estCost }) => {
          const isExpanded = isExpandable && expandedRows.has(rowKey);
          const tokenCells = [
            { key: "input", label: t("input"), value: shown.uncachedInput },
            { key: "cached", label: t("cached"), value: shown.cached },
            ...(hasCacheWrites ? [{ key: "cacheWrite", label: t("cacheWrite"), value: event.cacheWriteTokens ?? 0 }] : []),
            { key: "output", label: t("output"), value: event.outputTokens },
          ];

          return (
            <div key={rowKey} className={`space-y-2 px-1 py-2.5 ${getRowClasses(isCancelled, event.failed)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-medium text-[var(--text-primary)]" title={event.model}>
                    {event.model}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                    <span className="font-mono text-[var(--text-secondary)]">{event.keyName}</span>
                    {isAdmin && event.username ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{event.username}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <span title={formatTimestamp(event.timestamp)}>{formatRelativeTime(event.timestamp, t)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {estCost !== null ? formatUSD(estCost) : "\u2014"}
                    </span>
                    {renderStatusBadge(rowKey, isExpandable, isExpanded, isCancelled, event.failed, statusLabel)}
                  </div>
                  <span className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-semibold tabular-nums ${getLatencyClasses(event.latencyMs)}`}>
                    {formatLatency(event.latencyMs)}
                  </span>
                </div>
              </div>

              <div className={`grid gap-2 text-[11px] tabular-nums ${hasCacheWrites ? "grid-cols-4" : "grid-cols-3"}`}>
                {tokenCells.map((cell) => (
                  <div key={cell.key} className="min-w-0" title={cell.value.toLocaleString()}>
                    <span className="block truncate text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
                      {cell.label}
                    </span>
                    <span className="block truncate font-medium text-[var(--text-secondary)]">
                      {formatCompact(cell.value)}
                    </span>
                  </div>
                ))}
              </div>

              {isExpanded ? (
                <div className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 px-3 py-2 text-xs">
                  {renderFailureDetails(event, hasDetails)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop Event Table */}
      <div className="hidden overflow-x-auto border-t border-b border-[var(--surface-border)] lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-base)]">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("time")}</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("key")}</th>
              {isAdmin ? (
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("user")}</th>
              ) : null}
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("model")}</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("status")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("latency")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("input")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("cached")}</th>
              {hasCacheWrites ? (
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("cacheWrite")}</th>
              ) : null}
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("output")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("estCostHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ event, rowKey, isExpandable, isCancelled, statusLabel, hasDetails, shown, estCost }) => {
              const isExpanded = isExpandable && expandedRows.has(rowKey);

              return (
                <Fragment key={rowKey}>
                  <tr
                    className={`border-b border-[var(--surface-border)] last:border-b-0 ${getRowClasses(isCancelled, event.failed)}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-[var(--text-primary)]">{formatRelativeTime(event.timestamp, t)}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{formatTimestamp(event.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">{event.keyName}</td>
                    {isAdmin ? (
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{event.username ?? "\u2014"}</td>
                    ) : null}
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">{event.model}</td>
                    <td className="px-3 py-2">
                      {renderStatusBadge(rowKey, isExpandable, isExpanded, isCancelled, event.failed, statusLabel)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${getLatencyClasses(event.latencyMs)}`}>
                        {formatLatency(event.latencyMs)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{shown.uncachedInput.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{shown.cached.toLocaleString()}</td>
                    {hasCacheWrites ? (
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{(event.cacheWriteTokens ?? 0).toLocaleString()}</td>
                    ) : null}
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{event.outputTokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-secondary)]">
                      {estCost !== null ? formatUSD(estCost) : "\u2014"}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-muted)]/60">
                      <td colSpan={colCount} className="px-4 py-2.5 text-xs">
                        {renderFailureDetails(event, hasDetails)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
