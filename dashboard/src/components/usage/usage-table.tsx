"use client";

import React, { useState } from "react";

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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (Object.keys(keys).length === 0) {
    return (
      <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center">
        <p className="text-sm text-slate-400">No usage data yet</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Usage by API Key</h2>
      <div className="overflow-x-auto">
        <div className="min-w-[600px] rounded-md border border-slate-700/70 bg-slate-900/25">
          <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-700/70 bg-slate-900/95 backdrop-blur-sm">
            <tr>
              <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 w-8"></th>
              <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Key Name</th>
              {isAdmin && (
                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Username</th>
              )}
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Success</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Failed</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(keys).map(([authIndex, keyUsage]) => {
              const isExpanded = expandedKeys.has(authIndex);
              const hasModels = Object.keys(keyUsage.models).length > 0;

              return (
                <React.Fragment key={authIndex}>
                  <tr
                    className={`border-b border-slate-700/60 ${hasModels ? "cursor-pointer hover:bg-slate-800/40" : ""}`}
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
                    <td className="p-2 text-slate-400">
                      {hasModels && (
                        <span className="text-xs">
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs text-slate-200">{keyUsage.keyName}</td>
                    {isAdmin && (
                      <td className="p-2 text-xs text-slate-300">{keyUsage.username || "\u2014"}</td>
                    )}
                    <td className="p-2 text-right text-xs text-slate-300">{keyUsage.totalRequests.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-slate-300">{keyUsage.successCount.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-slate-300">{keyUsage.failureCount.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-slate-300">{keyUsage.totalTokens.toLocaleString()}</td>
                  </tr>

                  {isExpanded && hasModels && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="p-0 bg-slate-900/25">
                        <div className="p-3 pl-8">
                          <table className="w-full text-xs">
                            <thead className="border-b border-slate-700/60">
                              <tr>
                                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Model</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Requests</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Input</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Output</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(keyUsage.models).map(([modelName, modelData]) => (
                                <tr key={modelName} className="border-b border-slate-700/40 last:border-0">
                                  <td className="p-2 text-left font-mono text-[11px] text-slate-300">{modelName}</td>
                                  <td className="p-2 text-right text-slate-400">{modelData.totalRequests.toLocaleString()}</td>
                                  <td className="p-2 text-right text-slate-400">{modelData.inputTokens.toLocaleString()}</td>
                                  <td className="p-2 text-right text-slate-400">{modelData.outputTokens.toLocaleString()}</td>
                                  <td className="p-2 text-right text-slate-400">{modelData.totalTokens.toLocaleString()}</td>
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
