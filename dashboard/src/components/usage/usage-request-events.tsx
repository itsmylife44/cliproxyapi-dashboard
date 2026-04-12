"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface RequestEvent {
  timestamp: string;
  keyName: string;
  username?: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  failed: boolean;
}

interface UsageRequestEventsProps {
  events?: RequestEvent[];
  isAdmin: boolean;
  truncated?: boolean;
}

const EVENTS_PER_PAGE = 25;

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

export function UsageRequestEvents({ events, isAdmin, truncated }: UsageRequestEventsProps) {
  const t = useTranslations("usage");
  const [currentPage, setCurrentPage] = useState(1);

  const safeEvents = useMemo(() => events ?? [], [events]);
  const totalPages = Math.max(1, Math.ceil(safeEvents.length / EVENTS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);

  const pagedEvents = useMemo(() => {
    const start = (activePage - 1) * EVENTS_PER_PAGE;
    return safeEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [activePage, safeEvents]);

  const hasMissingLatency = safeEvents.some((event) => event.latencyMs <= 0);

  if (safeEvents.length === 0) {
    return (
      <section className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("requestEvents")}</h2>
        <p className="mt-3 text-sm text-[var(--text-muted)]">{t("noEventsFound")}</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
      <div className="flex flex-col gap-2 border-b border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("requestEvents")}</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("showingMostRecent", { count: safeEvents.length })}
            {truncated ? ` ${t("truncatedOnServer")}` : ""}
          </p>
        </div>
        {hasMissingLatency ? (
          <p className="text-[11px] text-[var(--text-muted)]">{t("latencyNotAvailableNote")}</p>
        ) : null}
      </div>

      <div className="max-h-[clamp(320px,62vh,760px)] overflow-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("time")}</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("key")}</th>
              {isAdmin ? (
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("user")}</th>
              ) : null}
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("model")}</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("status")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("latency")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("input")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("output")}</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tokens")}</th>
            </tr>
          </thead>
          <tbody>
            {pagedEvents.map((event, index) => (
              <tr
                key={`${event.timestamp}-${event.model}-${index}`}
                className={`border-b border-[var(--surface-border)] last:border-b-0 ${event.failed ? "bg-rose-500/100/[0.03]" : "hover:bg-[var(--surface-muted)]"}`}
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
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      event.failed
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                    }`}
                  >
                    {event.failed ? t("failed") : t("success")}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${getLatencyClasses(event.latencyMs)}`}>
                    {formatLatency(event.latencyMs)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{event.inputTokens.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-muted)]">{event.outputTokens.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--text-primary)]">{event.totalTokens.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-[var(--surface-border)] px-3 py-2">
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={activePage === 1}
            className="px-2.5 py-1 text-xs"
          >
            {t("previous")}
          </Button>
          <span className="text-xs text-[var(--text-muted)]">
            {t("pageOf", { page: activePage, total: totalPages })}
          </span>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={activePage === totalPages}
            className="px-2.5 py-1 text-xs"
          >
            {t("next")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
