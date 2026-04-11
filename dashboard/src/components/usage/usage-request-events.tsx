"use client";

import { useMemo, useState } from "react";
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

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
  if (latencyMs < 1000) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (latencyMs < 5000) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-600";
}

function formatLatency(latencyMs: number): string {
  if (latencyMs <= 0) return "\u2014";
  return `${latencyMs.toLocaleString()} ms`;
}

export function UsageRequestEvents({ events, isAdmin, truncated }: UsageRequestEventsProps) {
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
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Request Event Details</h2>
        <p className="mt-3 text-sm text-[var(--text-muted)]">No request events found in the selected period</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
      <div className="flex flex-col gap-2 border-b border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Request Event Details</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Showing the most recent {safeEvents.length} requests in the selected window.
            {truncated ? " Larger result sets were truncated on the server." : ""}
          </p>
        </div>
        {hasMissingLatency ? (
          <p className="text-[11px] text-[var(--text-muted)]">\u2014 means latency was not available for that collected request</p>
        ) : null}
      </div>

      <div className="max-h-[clamp(320px,62vh,760px)] overflow-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]">
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Time</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Key</th>
              {isAdmin ? (
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">User</th>
              ) : null}
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Model</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Status</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Latency</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Input</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Output</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {pagedEvents.map((event, index) => (
              <tr
                key={`${event.timestamp}-${event.model}-${index}`}
                className={`border-b border-[var(--surface-border)] last:border-b-0 ${event.failed ? "bg-rose-500/[0.03]" : "hover:bg-[var(--surface-muted)]"}`}
              >
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-primary)]">{formatRelativeTime(event.timestamp)}</span>
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
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {event.failed ? "Failed" : "Success"}
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
            Previous
          </Button>
          <span className="text-xs text-[var(--text-muted)]">
            Page {activePage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={activePage === totalPages}
            className="px-2.5 py-1 text-xs"
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}
