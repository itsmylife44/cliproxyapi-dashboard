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
      <section className="rounded-md border border-[#e5e5e5] bg-white p-6 text-center">
        <p className="text-sm text-[#777169]">No usage data yet</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#777169]">Usage by API Key</h2>
      <div className="overflow-x-auto">
        <div className="min-w-[600px] rounded-md border border-[#e5e5e5] bg-white">
          <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[#e5e5e5] bg-white">
            <tr>
              <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169] w-8"></th>
              <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Key Name</th>
              {isAdmin && (
                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Username</th>
              )}
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Total</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Success</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Failed</th>
              <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(keys).map(([authIndex, keyUsage]) => {
              const isExpanded = expandedKeys.has(authIndex);
              const hasModels = Object.keys(keyUsage.models).length > 0;

              return (
                <React.Fragment key={authIndex}>
                  <tr
                    className={`border-b border-[#e5e5e5] ${hasModels ? "cursor-pointer hover:bg-[#f5f5f5]" : ""}`}
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
                    <td className="p-2 text-[#777169]">
                      {hasModels && (
                        <span className="text-xs">
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs text-black">{keyUsage.keyName}</td>
                    {isAdmin && (
                      <td className="p-2 text-xs text-[#4e4e4e]">{keyUsage.username || "\u2014"}</td>
                    )}
                    <td className="p-2 text-right text-xs text-[#4e4e4e]">{keyUsage.totalRequests.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-[#4e4e4e]">{keyUsage.successCount.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-[#4e4e4e]">{keyUsage.failureCount.toLocaleString()}</td>
                    <td className="p-2 text-right text-xs text-[#4e4e4e]">{keyUsage.totalTokens.toLocaleString()}</td>
                  </tr>

                  {isExpanded && hasModels && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="p-0 bg-white">
                        <div className="p-3 pl-8">
                          <table className="w-full text-xs">
                            <thead className="border-b border-[#e5e5e5]">
                              <tr>
                                <th className="p-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Model</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Requests</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Input</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Output</th>
                                <th className="p-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777169]">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(keyUsage.models).map(([modelName, modelData]) => (
                                <tr key={modelName} className="border-b border-[#e5e5e5]/40 last:border-0">
                                  <td className="p-2 text-left font-mono text-[11px] text-[#4e4e4e]">{modelName}</td>
                                  <td className="p-2 text-right text-[#777169]">{modelData.totalRequests.toLocaleString()}</td>
                                  <td className="p-2 text-right text-[#777169]">{modelData.inputTokens.toLocaleString()}</td>
                                  <td className="p-2 text-right text-[#777169]">{modelData.outputTokens.toLocaleString()}</td>
                                  <td className="p-2 text-right text-[#777169]">{modelData.totalTokens.toLocaleString()}</td>
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
