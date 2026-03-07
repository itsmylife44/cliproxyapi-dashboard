"use client";

import type { BackgroundTaskConfig, OhMyOpenCodeFullConfig } from "@/lib/config-generators/oh-my-opencode-types";

interface ConcurrencyRow {
  _id: string;
  key: string;
  value: number;
}

interface BackgroundTasksSectionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  overrides: OhMyOpenCodeFullConfig;
  providerConcurrencyRows: ReadonlyArray<ConcurrencyRow>;
  modelConcurrencyRows: ReadonlyArray<ConcurrencyRow>;
  onBgTaskNumberChange: (field: keyof BackgroundTaskConfig, value: number) => void;
  onProviderConcurrencyChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onProviderConcurrencyAdd: () => void;
  onProviderConcurrencyRemove: (index: number) => void;
  onModelConcurrencyChange: (index: number, field: "key" | "value", newValue: string | number) => void;
  onModelConcurrencyAdd: () => void;
  onModelConcurrencyRemove: (index: number) => void;
}

export function BackgroundTasksSection({
  isExpanded,
  onToggleExpand,
  overrides,
  providerConcurrencyRows,
  modelConcurrencyRows,
  onBgTaskNumberChange,
  onProviderConcurrencyChange,
  onProviderConcurrencyAdd,
  onProviderConcurrencyRemove,
  onModelConcurrencyChange,
  onModelConcurrencyAdd,
  onModelConcurrencyRemove,
}: BackgroundTasksSectionProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="flex-1 text-left">Background Tasks</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="space-y-1">
            <span className="text-xs text-white/50">Default Concurrency</span>
            <input
              type="number"
              min={1}
              defaultValue={overrides.background_task?.defaultConcurrency ?? 5}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(parsed) && parsed > 0) {
                  onBgTaskNumberChange("defaultConcurrency", parsed);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-white/50">Stale Timeout (ms)</span>
            <input
              type="number"
              min={60000}
              defaultValue={overrides.background_task?.staleTimeoutMs ?? 180000}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(parsed) && parsed >= 60000) {
                  onBgTaskNumberChange("staleTimeoutMs", parsed);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Provider Concurrency</span>
              <button
                type="button"
                onClick={onProviderConcurrencyAdd}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Add
              </button>
            </div>
            {providerConcurrencyRows.map((row, idx) => (
              <div key={row._id} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Provider"
                  value={row.key}
                  onChange={(e) => onProviderConcurrencyChange(idx, "key", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
                <input
                  type="number"
                  min={1}
                  value={row.value}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed) && parsed > 0) {
                      onProviderConcurrencyChange(idx, "value", parsed);
                    }
                  }}
                  className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => onProviderConcurrencyRemove(idx)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Model Concurrency</span>
              <button
                type="button"
                onClick={onModelConcurrencyAdd}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Add
              </button>
            </div>
            {modelConcurrencyRows.map((row, idx) => (
              <div key={row._id} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Model"
                  value={row.key}
                  onChange={(e) => onModelConcurrencyChange(idx, "key", e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
                <input
                  type="number"
                  min={1}
                  value={row.value}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(parsed) && parsed > 0) {
                      onModelConcurrencyChange(idx, "value", parsed);
                    }
                  }}
                  className="w-20 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => onModelConcurrencyRemove(idx)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
