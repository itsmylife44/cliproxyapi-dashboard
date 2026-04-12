"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";

interface KeyUsage {
  keyName: string;
  username?: string;
  userId?: string;
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  successCount: number;
  failureCount: number;
  models: Record<string, {
    totalRequests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

interface UsageTableProps {
  keys: Record<string, KeyUsage>;
  isAdmin: boolean;
}

export function UsageTable({ keys, isAdmin }: UsageTableProps) {
  const t = useTranslations("usage");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (Object.keys(keys).length === 0) {
    return (
      <section className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">{t("noUsageData")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("usageByApiKey")}</h2>
      <div className="overflow-x-auto">
        <div className="min-w-[600px] rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
          <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]">
            <tr>
              <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] w-8"></th>
              <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("keyName")}</th>
              {isAdmin && (
                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("username")}</th>
              )}
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("total")}</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("success")}</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("failed")}</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tokens")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(keys).map(([authIndex, keyUsage]) => {
              const isExpanded = expandedKeys.has(authIndex);
              const hasModels = Object.keys(keyUsage.models).length > 0;

              return (
                <React.Fragment key={authIndex}>
                  <tr
                    className={`border-b border-[var(--surface-border)] ${hasModels ? "cursor-pointer hover:bg-[var(--surface-muted)]" : ""}`}
                    tabIndex={hasModels ? 0 : undefined}
                    aria-expanded={hasModels ? isExpanded : undefined}
                    onClick={() => {
                      if (hasModels) {
                        setExpandedKeys(prev => {
                          const next = new Set(prev);
                          if (next.has(authIndex)) {
                            next.delete(authIndex);
                          } else {
                            next.add(authIndex);
                          }
                          return next;
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (hasModels && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setExpandedKeys(prev => {
                          const next = new Set(prev);
                          if (next.has(authIndex)) {
                            next.delete(authIndex);
                          } else {
                            next.add(authIndex);
                          }
                          return next;
                        });
                      }
                    }}
                  >
                    <td className="p-2 text-[var(--text-muted)]">
                      {hasModels && (
                        <span className="text-xs">
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs text-[var(--text-primary)]">{keyUsage.keyName}</td>
                    {isAdmin && (
                      <td className="p-2 text-xs text-[var(--text-secondary)]">{keyUsage.username || "\u2014"}</td>
                    )}
                    <td className="p-2 text-right text-xs text-[var(--text-secondary)]">{keyUsage.totalRequests.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-[var(--text-secondary)]">{keyUsage.successCount.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-[var(--text-secondary)]">{keyUsage.failureCount.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-[var(--text-secondary)]">{keyUsage.totalTokens.toLocaleString()}</td>
                  </tr>

                  {isExpanded && hasModels && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="p-0 bg-[var(--surface-base)]">
                        <div className="p-3 pl-8">
                          <table className="w-full text-xs">
                            <thead className="border-b border-[var(--surface-border)]">
                              <tr>
                                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("model")}</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("requests")}</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("input")}</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("output")}</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("total")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(keyUsage.models).map(([modelName, modelData]) => (
                                <tr key={modelName} className="border-b border-[var(--surface-border)]/40 last:border-0">
                                  <td className="p-2 text-left font-mono text-[11px] text-[var(--text-secondary)]">{modelName}</td>
                                  <td className="p-2 text-right text-[var(--text-muted)]">{modelData.totalRequests.toLocaleString()}</td>
                                  <td className="p-2 text-right text-[var(--text-muted)]">{modelData.inputTokens.toLocaleString()}</td>
                                  <td className="p-2 text-right text-[var(--text-muted)]">{modelData.outputTokens.toLocaleString()}</td>
                                  <td className="p-2 text-right text-[var(--text-muted)]">{modelData.totalTokens.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
