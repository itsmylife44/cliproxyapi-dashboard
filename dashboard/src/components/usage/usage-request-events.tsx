"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatCompact } from "@/components/ui/chart-theme";
import {
  calculateRequestCost,
  formatUSD,
  loadCustomPricing,
  resolveModelPrice,
  splitCachedInput,
  type ModelPrice,
} from "@/lib/model-pricing";

export interface RequestEvent {
  id: string;
  apiKeyId: string | null;
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

interface PreparedRow {
  event: RequestEvent;
  rowKey: string;
  isExpandable: boolean;
  isCancelled: boolean;
  statusLabel: string;
  hasDetails: boolean;
  shown: { uncachedInput: number; cached: number };
  estCost: number | null;
}

interface FeedItem {
  kind: "single" | "group";
  key: string;
  rows: PreparedRow[];
  first: PreparedRow;
  last: PreparedRow;
  avgLatencyMs: number;
  uncachedInput: number;
  cached: number;
  cacheWrite: number;
  output: number;
  estCost: number | null;
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
  if (latencyMs < 1000) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (latencyMs < 5000) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

function formatLatency(latencyMs: number): string {
  if (latencyMs <= 0) return "\u2014";
  return `${Math.round(latencyMs).toLocaleString()} ms`;
}

function getStatusBadgeClasses(isCancelled: boolean, failed: boolean): string {
  if (isCancelled) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (failed) return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
}

function getRowClasses(isCancelled: boolean, failed: boolean): string {
  if (isCancelled) return "bg-amber-500/[0.03] hover:bg-amber-500/[0.07]";
  if (failed) return "bg-rose-500/[0.03] hover:bg-rose-500/[0.07]";
  return "hover:bg-[var(--surface-muted)]/60";
}

function estimateEventCost(
  event: RequestEvent,
  price: ModelPrice | null,
): number | null {
  if (!price) return null;
  return calculateRequestCost({
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    cachedTokens: event.cachedTokens ?? 0,
    cacheWriteTokens: event.cacheWriteTokens,
    cacheWrite1hTokens: event.cacheWrite1hTokens,
  }, new Date(event.timestamp), price);
}

function buildFeedItems(rows: PreparedRow[]): FeedItem[] {
  const items: FeedItem[] = [];
  let i = 0;

  while (i < rows.length) {
    const start = rows[i]!;
    // Compare request identity and outcome, not display labels.
    const groupRows: PreparedRow[] = [start];
    let j = i + 1;
    while (j < rows.length) {
      const candidate = rows[j]!;
      if (
        candidate.event.failed !== start.event.failed ||
        candidate.isCancelled !== start.isCancelled ||
        candidate.event.failureStatus !== start.event.failureStatus ||
        candidate.event.model !== start.event.model ||
        start.event.apiKeyId === null ||
        candidate.event.apiKeyId !== start.event.apiKeyId
      ) {
        break;
      }
      groupRows.push(candidate);
      j += 1;
    }

    if (groupRows.length === 1) {
      items.push({
        kind: "single",
        key: start.rowKey,
        rows: groupRows,
        first: start,
        last: start,
        avgLatencyMs: start.event.latencyMs,
        uncachedInput: start.shown.uncachedInput,
        cached: start.shown.cached,
        cacheWrite: start.event.cacheWriteTokens ?? 0,
        output: start.event.outputTokens,
        estCost: start.estCost,
      });
    } else {
      let latencySum = 0;
      let latencySamples = 0;
      let uncachedInput = 0;
      let cached = 0;
      let cacheWrite = 0;
      let output = 0;
      let costSum = 0;
      let hasCost = false;

      for (const r of groupRows) {
        if (r.event.latencyMs > 0) {
          latencySum += r.event.latencyMs;
          latencySamples += 1;
        }
        uncachedInput += r.shown.uncachedInput;
        cached += r.shown.cached;
        cacheWrite += r.event.cacheWriteTokens ?? 0;
        output += r.event.outputTokens;
        if (r.estCost !== null) {
          costSum += r.estCost;
          hasCost = true;
        }
      }

      const last = groupRows[groupRows.length - 1]!;
      items.push({
        kind: "group",
        key: `group-${last.rowKey}`,
        rows: groupRows,
        first: start,
        last,
        avgLatencyMs: latencySamples > 0 ? Math.round(latencySum / latencySamples) : 0,
        uncachedInput,
        cached,
        cacheWrite,
        output,
        estCost: hasCost ? costSum : null,
      });
    }

    i = j;
  }

  return items;
}

const ITEMS_PER_PAGE = 10;

export function UsageRequestEvents({ events, isAdmin, livePricing }: UsageRequestEventsProps) {
  const t = useTranslations("usage");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const customPricing = useMemo(() => loadCustomPricing(), []);

  const safeEvents = useMemo(() => events ?? [], [events]);
  const hasMissingLatency = safeEvents.some((event) => event.latencyMs <= 0);
  const hasCacheWrites = safeEvents.some((event) => (event.cacheWriteTokens ?? 0) > 0);
  const colCount = (isAdmin ? 10 : 9) + (hasCacheWrites ? 1 : 0);

  const rows = useMemo<PreparedRow[]>(
    () =>
      safeEvents.map((event) => {
        const rowKey = event.id;
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

  const feedItems = useMemo(() => buildFeedItems(rows), [rows]);

  const totalPages = Math.max(1, Math.ceil(feedItems.length / ITEMS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const pagedItems = useMemo(() => {
    const start = (activePage - 1) * ITEMS_PER_PAGE;
    return feedItems.slice(start, start + ITEMS_PER_PAGE);
  }, [activePage, feedItems]);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, Math.trunc(page)));
    setCurrentPage(clamped);
    setPageDraft(null);
  };

  const commitPageDraft = () => {
    if (pageDraft === null) return;
    const parsed = Number.parseInt(pageDraft, 10);
    if (Number.isFinite(parsed)) {
      goToPage(parsed);
    } else {
      setPageDraft(null);
    }
  };

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

  const renderPagination = (position: "top" | "bottom") => (
    <div
      className={`flex items-center gap-1.5 ${
        position === "bottom" ? "justify-center pt-2" : "justify-end"
      }`}
    >
      <button
        type="button"
        onClick={() => goToPage(activePage - 1)}
        disabled={activePage <= 1}
        aria-label={t("previous")}
        title={t("previous")}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        &lt;
      </button>
      <div className="inline-flex items-center gap-1.5 text-xs tabular-nums text-[var(--text-muted)]">
        <input
          type="text"
          inputMode="numeric"
          aria-label={t("pageOf", { page: activePage, total: totalPages })}
          value={pageDraft ?? String(activePage)}
          onChange={(e) => setPageDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commitPageDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitPageDraft();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setPageDraft(null);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="glass-input h-7 w-11 rounded-md px-1.5 text-center text-xs font-medium tabular-nums text-[var(--text-primary)]"
        />
        <span>/</span>
        <span className="font-medium text-[var(--text-secondary)]">{totalPages}</span>
      </div>
      <button
        type="button"
        onClick={() => goToPage(activePage + 1)}
        disabled={activePage >= totalPages}
        aria-label={t("next")}
        title={t("next")}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        &gt;
      </button>
    </div>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs text-[var(--text-muted)]">
            {t("showingMostRecent", { count: safeEvents.length })}
          </p>
          {hasMissingLatency ? (
            <p className="text-[11px] text-[var(--text-muted)]">{t("latencyNotAvailableNote")}</p>
          ) : null}
        </div>
        {totalPages > 1 ? renderPagination("top") : null}
      </div>

      {/* Responsive Event Feed (Mobile / Tablet) */}
      <div className="divide-y divide-[var(--surface-border)] border-t border-b border-[var(--surface-border)] lg:hidden">
        {pagedItems.map((item) => {
          const isGroup = item.kind === "group";
          const { event, rowKey, isExpandable, isCancelled, statusLabel, hasDetails } = item.first;
          const isExpanded = expandedRows.has(isGroup ? item.key : rowKey);
          const tokenCells = [
            { key: "input", label: t("input"), value: item.uncachedInput },
            { key: "cached", label: t("cached"), value: item.cached },
            ...(hasCacheWrites ? [{ key: "cacheWrite", label: t("cacheWrite"), value: item.cacheWrite }] : []),
            { key: "output", label: t("output"), value: item.output },
          ];
          const firstRel = formatRelativeTime(item.first.event.timestamp, t);
          const lastRel = formatRelativeTime(item.last.event.timestamp, t);
          const timeLabel = isGroup && firstRel !== lastRel ? `${lastRel} – ${firstRel}` : firstRel;

          return (
            <div key={item.key} className={`space-y-2 px-1 py-2.5 ${getRowClasses(isCancelled, event.failed)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isGroup ? (
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleRow(item.key)}
                        className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-left"
                      >
                        <span aria-hidden="true" className="text-[9px] text-[var(--text-muted)]">
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </span>
                        <span className="truncate font-mono text-xs font-medium text-[var(--text-primary)]" title={event.model}>
                          {event.model}
                        </span>
                        <span className="shrink-0 rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0 font-mono text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
                          ×{item.rows.length}
                        </span>
                      </button>
                    ) : (
                      <p className="truncate font-mono text-xs font-medium text-[var(--text-primary)]" title={event.model}>
                        {event.model}
                      </p>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                    <span className="font-mono text-[var(--text-secondary)]">{event.keyName}</span>
                    {isAdmin && event.username ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{event.username}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <span title={formatTimestamp(event.timestamp)}>{timeLabel}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {item.estCost !== null ? formatUSD(item.estCost) : "\u2014"}
                    </span>
                    {renderStatusBadge(
                      rowKey,
                      !isGroup && isExpandable,
                      !isGroup && isExpanded,
                      isCancelled,
                      event.failed,
                      statusLabel
                    )}
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-semibold tabular-nums ${getLatencyClasses(item.avgLatencyMs)}`}
                    title={isGroup ? t("avgLatency") : undefined}
                  >
                    {isGroup ? `${t("avgLatency")} ${formatLatency(item.avgLatencyMs)}` : formatLatency(item.avgLatencyMs)}
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

              {!isGroup && isExpanded ? (
                <div className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 px-3 py-2 text-xs">
                  {renderFailureDetails(event, hasDetails)}
                </div>
              ) : null}

              {isGroup && isExpanded ? (
                <div className="divide-y divide-[var(--surface-border)]/50 rounded border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 px-2.5 py-1">
                  {item.rows.map((child) => (
                    <div key={child.rowKey} className="py-1.5 text-[11px] tabular-nums">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[var(--text-muted)]" title={formatTimestamp(child.event.timestamp)}>
                          {formatTimestamp(child.event.timestamp)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
                          {renderStatusBadge(
                            child.rowKey,
                            child.isExpandable,
                            expandedRows.has(child.rowKey),
                            child.isCancelled,
                            child.event.failed,
                            child.statusLabel
                          )}
                          <span>{formatCompact(child.shown.uncachedInput)} / {formatCompact(child.shown.cached)} / {formatCompact(child.event.outputTokens)}</span>
                          <span className={`rounded-full border px-1.5 py-0 text-[10px] font-semibold ${getLatencyClasses(child.event.latencyMs)}`}>
                            {formatLatency(child.event.latencyMs)}
                          </span>
                          <span className="font-medium">
                            {child.estCost !== null ? formatUSD(child.estCost) : "\u2014"}
                          </span>
                        </div>
                      </div>
                      {expandedRows.has(child.rowKey) ? (
                        <div className="mt-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-muted)]/60 px-3 py-2 text-xs">
                          {renderFailureDetails(child.event, child.hasDetails)}
                        </div>
                      ) : null}
                    </div>
                  ))}
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
            {pagedItems.map((item) => {
              const isGroup = item.kind === "group";
              const { event, rowKey, isExpandable, isCancelled, statusLabel, hasDetails } = item.first;
              const isExpanded = expandedRows.has(isGroup ? item.key : rowKey);
              const firstRel = formatRelativeTime(item.first.event.timestamp, t);
              const lastRel = formatRelativeTime(item.last.event.timestamp, t);
              const timeLabel = isGroup && firstRel !== lastRel ? `${lastRel} – ${firstRel}` : firstRel;

              return (
                <Fragment key={item.key}>
                  <tr
                    className={`border-b border-[var(--surface-border)] last:border-b-0 ${getRowClasses(isCancelled, event.failed)}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-[var(--text-primary)]">{timeLabel}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{formatTimestamp(event.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">{event.keyName}</td>
                    {isAdmin ? (
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{event.username ?? "\u2014"}</td>
                    ) : null}
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                      {isGroup ? (
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleRow(item.key)}
                          className="inline-flex cursor-pointer items-center gap-1.5 text-left hover:text-[var(--text-primary)]"
                        >
                          <span aria-hidden="true" className="text-[9px] text-[var(--text-muted)]">
                            {isExpanded ? "\u25BC" : "\u25B6"}
                          </span>
                          <span>{event.model}</span>
                          <span className="rounded border border-[var(--surface-border)] bg-[var(--surface-muted)] px-1.5 py-0 text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">
                            ×{item.rows.length}
                          </span>
                        </button>
                      ) : (
                        event.model
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {renderStatusBadge(
                        rowKey,
                        !isGroup && isExpandable,
                        !isGroup && isExpanded,
                        isCancelled,
                        event.failed,
                        statusLabel
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${getLatencyClasses(item.avgLatencyMs)}`}
                        title={isGroup ? t("avgLatency") : undefined}
                      >
                        {formatLatency(item.avgLatencyMs)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{item.uncachedInput.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{item.cached.toLocaleString()}</td>
                    {hasCacheWrites ? (
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{item.cacheWrite.toLocaleString()}</td>
                    ) : null}
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{item.output.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-secondary)]">
                      {item.estCost !== null ? formatUSD(item.estCost) : "\u2014"}
                    </td>
                  </tr>

                  {!isGroup && isExpanded ? (
                    <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-muted)]/60">
                      <td colSpan={colCount} className="px-4 py-2.5 text-xs">
                        {renderFailureDetails(event, hasDetails)}
                      </td>
                    </tr>
                  ) : null}

                  {isGroup && isExpanded
                    ? item.rows.map((child) => {
                        const childExpanded = expandedRows.has(child.rowKey);
                        return (
                          <Fragment key={child.rowKey}>
                            <tr className="border-b border-[var(--surface-border)]/50 bg-[var(--surface-muted)]/35 text-xs">
                              <td className="px-3 py-1.5 pl-6 text-[11px] text-[var(--text-muted)]">
                                {formatTimestamp(child.event.timestamp)}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-[11px] text-[var(--text-muted)]">{child.event.keyName}</td>
                              {isAdmin ? (
                                <td className="px-3 py-1.5 text-[11px] text-[var(--text-muted)]">{child.event.username ?? "\u2014"}</td>
                              ) : null}
                              <td className="px-3 py-1.5 font-mono text-[11px] text-[var(--text-muted)]">{child.event.model}</td>
                              <td className="px-3 py-1.5">
                                {renderStatusBadge(
                                  child.rowKey,
                                  child.isExpandable,
                                  childExpanded,
                                  child.isCancelled,
                                  child.event.failed,
                                  child.statusLabel
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <span className={`inline-flex rounded-full border px-2 py-0 text-[10px] font-semibold tabular-nums ${getLatencyClasses(child.event.latencyMs)}`}>
                                  {formatLatency(child.event.latencyMs)}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-[var(--text-muted)]">{child.shown.uncachedInput.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-[var(--text-muted)]">{child.shown.cached.toLocaleString()}</td>
                              {hasCacheWrites ? (
                                <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-[var(--text-muted)]">{(child.event.cacheWriteTokens ?? 0).toLocaleString()}</td>
                              ) : null}
                              <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-[var(--text-muted)]">{child.event.outputTokens.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-[var(--text-secondary)]">
                                {child.estCost !== null ? formatUSD(child.estCost) : "\u2014"}
                              </td>
                            </tr>
                            {childExpanded ? (
                              <tr className="border-b border-[var(--surface-border)]/50 bg-[var(--surface-muted)]/60">
                                <td colSpan={colCount} className="px-4 py-2.5 text-xs">
                                  {renderFailureDetails(child.event, child.hasDetails)}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {renderPagination("bottom")}
    </section>
  );
}
