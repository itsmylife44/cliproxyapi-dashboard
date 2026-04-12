"use client";

import type { McpEntry } from "@/lib/config-generators/opencode";
import { useTranslations } from "next-intl";

interface EnvRow {
  id: number;
  key: string;
  value: string;
}

interface McpSectionProps {
  mcps: McpEntry[];
  mcpName: string;
  mcpType: "local" | "remote";
  mcpCommand: string;
  mcpUrl: string;
  envRows: EnvRow[];
  onMcpNameChange: (value: string) => void;
  onMcpTypeChange: (value: "local" | "remote") => void;
  onMcpCommandChange: (value: string) => void;
  onMcpUrlChange: (value: string) => void;
  onAddMcp: () => void;
  onRemoveMcp: (name: string) => void;
  onToggleMcpEnabled: (name: string) => void;
  onAddEnvRow: () => void;
  onUpdateEnvRow: (index: number, field: "key" | "value", value: string) => void;
  onRemoveEnvRow: (index: number) => void;
}

export function McpSection({
  mcps,
  mcpName,
  mcpType,
  mcpCommand,
  mcpUrl,
  envRows,
  onMcpNameChange,
  onMcpTypeChange,
  onMcpCommandChange,
  onMcpUrlChange,
  onAddMcp,
  onRemoveMcp,
  onToggleMcpEnabled,
  onAddEnvRow,
  onUpdateEnvRow,
  onRemoveEnvRow,
}: McpSectionProps) {
  const t = useTranslations("openCodeConfig");
  return (
    <div className="space-y-2">
      <label htmlFor="mcp-name-input" className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {t("mcpServersTitle")}
      </label>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            id="mcp-name-input"
            type="text"
            value={mcpName}
            onChange={(e) => onMcpNameChange(e.target.value)}
            placeholder={t("mcpServerNamePlaceholder")}
            className="flex-1 bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
          />
          <select
            value={mcpType}
            onChange={(e) => onMcpTypeChange(e.target.value as "local" | "remote")}
            className="bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[rgba(0,0,0,0.15)] focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
          >
            <option value="local" className="bg-[var(--surface-base)] text-[var(--text-primary)]">{t("typeLocal")}</option>
            <option value="remote" className="bg-[var(--surface-base)] text-[var(--text-primary)]">{t("typeRemote")}</option>
          </select>
        </div>
        {mcpType === "remote" ? (
          <div className="space-y-2">
            <input
              type="text"
              value={mcpUrl}
              onChange={(e) => onMcpUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddMcp()}
              placeholder={t("mcpUrlPlaceholder")}
              className="w-full bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={mcpCommand}
              onChange={(e) => onMcpCommandChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddMcp()}
              placeholder={t("mcpCommandPlaceholder")}
              className="w-full bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
            />
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-[var(--surface-border)]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {t("envVarsLabel")}
            </label>
            <button
              type="button"
              onClick={onAddEnvRow}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {t("addEnvVar")}
            </button>
          </div>

          {envRows.length > 0 && (
            <div className="space-y-2">
              {envRows.map((row, index) => (
                <div key={row.id} className="flex gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => onUpdateEnvRow(index, "key", e.target.value)}
                    placeholder={t("keyPlaceholder")}
                    className="w-1/3 bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => onUpdateEnvRow(index, "value", e.target.value)}
                    placeholder={t("valuePlaceholder")}
                    className="flex-1 bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/20 focus:bg-[var(--surface-base)] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveEnvRow(index)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onAddMcp}
              className="px-4 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--surface-hover)] hover:border-[var(--surface-border)] transition-colors"
            >
              {t("addMcpServer")}
            </button>
          </div>
        </div>
      </div>
      {mcps.length > 0 && <McpList mcps={mcps} onRemove={onRemoveMcp} onToggleEnabled={onToggleMcpEnabled} />}
    </div>
  );
}

interface McpListProps {
  mcps: McpEntry[];
  onRemove: (name: string) => void;
  onToggleEnabled: (name: string) => void;
}

function McpList({ mcps, onRemove, onToggleEnabled }: McpListProps) {
  const t = useTranslations("openCodeConfig");
  return (
    <div className="space-y-1.5">
      {mcps.map((mcp) => {
        const isEnabled = mcp.enabled !== false;
        const envCount = mcp.environment ? Object.keys(mcp.environment).length : 0;
        return (
          <div
            key={mcp.name}
            className={`flex items-start justify-between px-3 py-3 rounded-lg border transition-colors ${
              isEnabled
                ? "bg-[var(--surface-muted)] border-[var(--surface-border)]"
                : "bg-[var(--surface-muted)] border-[var(--surface-border)] opacity-60"
            }`}
          >
            <div className="flex-1 space-y-2 overflow-hidden mr-4">
              <div className="flex items-center gap-2 text-sm font-mono">
                <span className={isEnabled ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{mcp.name}</span>
                <span className="text-[var(--text-muted)]">&rarr;</span>
                {mcp.type === "remote" ? (
                  <>
                    <span className={isEnabled ? "text-[var(--text-secondary)] text-xs" : "text-[var(--text-muted)] text-xs"}>{t("typeRemote")}</span>
                    <span className="text-[var(--text-muted)] text-xs truncate" title={mcp.url}>{mcp.url}</span>
                  </>
                ) : (
                  <>
                    <span className={isEnabled ? "text-emerald-600 text-xs" : "text-[var(--text-muted)] text-xs"}>{t("typeLocal")}</span>
                    <div className="flex flex-wrap gap-1">
                      {mcp.command.map((cmd, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[var(--surface-muted)] rounded text-[var(--text-secondary)] text-[10px] whitespace-nowrap">
                          {cmd}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {envCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-muted)] uppercase">
                    {envCount} {envCount !== 1 ? t("envVars") : t("envVar")}
                  </span>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {Object.entries(mcp.environment!).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap" title={`${k}=${v}`}>
                        <span className="text-[var(--text-muted)]">{k}</span>={v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onToggleEnabled(mcp.name)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  isEnabled ? "bg-emerald-500/100" : "bg-[var(--surface-hover)]"
                }`}
                aria-label={`${t("toggleAriaLabel")} ${mcp.name}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[var(--surface-base)] shadow-lg transition duration-200 ease-in-out ${
                    isEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => onRemove(mcp.name)}
                className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                aria-label={`${t("removeAriaLabel")} ${mcp.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <title>{t("removeAriaLabel")}</title>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
