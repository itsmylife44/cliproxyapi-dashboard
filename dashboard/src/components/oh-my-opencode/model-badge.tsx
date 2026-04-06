"use client";

import { useEffect, useRef, useState } from "react";

import { groupModelsByProvider } from "@/lib/providers/model-grouping";

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface AgentUltraworkConfig {
  model?: string;
  variant?: string;
  temperature?: number;
}

export interface ExtraFieldConfig {
  variant?: string;
  temperature?: number;
  thirdField?: string;
  thirdFieldKey: string;
  thirdFieldPlaceholder: string;
  fallback_models?: string[];
  supportsUltrawork?: boolean;
  ultrawork?: AgentUltraworkConfig;
}

export type ModelBadgeFieldValue =
  | string
  | number
  | string[]
  | AgentUltraworkConfig
  | undefined;

export const TIER_META: Record<1 | 2 | 3 | 4, { label: string; hint: string }> = {
  1: { label: "Tier 1", hint: "Critical reasoning" },
  2: { label: "Tier 2", hint: "Planning and review" },
  3: { label: "Tier 3", hint: "Fast execution" },
  4: { label: "Tier 4", hint: "Visual and creative" },
};

interface ModelBadgeProps {
  name: string;
  model: string;
  isOverride: boolean;
  showName?: boolean;
  availableModels: string[];
  modelSourceMap?: Map<string, string>;
  onSelect: (value: string | undefined) => void;
  extraFields?: ExtraFieldConfig;
  onFieldChange?: (field: string, value: ModelBadgeFieldValue) => void;
}

export function ModelBadge({
  name,
  model,
  isOverride,
  showName = true,
  availableModels,
  modelSourceMap,
  onSelect,
  extraFields,
  onFieldChange,
}: ModelBadgeProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasUltraworkValues = Boolean(
    extraFields?.ultrawork &&
      (extraFields.ultrawork.model ||
        extraFields.ultrawork.variant ||
        extraFields.ultrawork.temperature !== undefined)
  );
  const hasExtraValues =
    extraFields &&
    (extraFields.variant ||
      extraFields.temperature !== undefined ||
      extraFields.thirdField ||
      (extraFields.fallback_models && extraFields.fallback_models.length > 0) ||
      hasUltraworkValues);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    }
    setOpen(!open);
    setSearch("");
  };

  const filteredModels = search
    ? availableModels.filter((m) => m.toLowerCase().includes(search.toLowerCase()))
    : availableModels;
  const groupedFilteredModels = groupModelsByProvider(filteredModels, modelSourceMap);

  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex items-center gap-0">
        <button
          ref={btnRef}
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-l-lg text-xs font-mono cursor-pointer transition-colors hover:bg-[#f0f0f0] ${
            isOverride
              ? "bg-[#f5f5f5] border border-[#e5e5e5] text-[#4e4e4e]"
              : "bg-[#f5f5f5] border border-[#e5e5e5] text-[#4e4e4e]"
          }`}
        >
          {showName && (
            <>
              <span className="text-black">{name}</span>
              <span className="text-[#aaa]">&rarr;</span>
            </>
          )}
          <span>{model}</span>
          {hasExtraValues && <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />}
        </button>
        {onFieldChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowExtra(!showExtra);
            }}
            className={`px-1.5 py-1 border border-l-0 rounded-r-lg text-[10px] transition-colors cursor-pointer ${
              showExtra || hasExtraValues
                ? "bg-amber-50 border-amber-200 text-amber-700/80 hover:bg-amber-50"
                : "bg-[#f5f5f5] border-[#e5e5e5] text-[#aaa] hover:text-[#777169] hover:bg-[#f0f0f0]"
            }`}
            title="Configure variant, temperature, and more"
          >
            <svg
              aria-hidden="true"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        )}
      </div>

      {showExtra && onFieldChange && (
        <div className="mt-1 ml-0.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="variant"
              value={extraFields?.variant ?? ""}
              onChange={(e) => onFieldChange("variant", e.target.value || undefined)}
              className="w-16 px-1.5 py-0.5 text-[10px] bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#4e4e4e] placeholder:text-[#bbb] focus:outline-none focus:border-black/15"
            />
            <input
              type="number"
              placeholder="temp"
              step={0.1}
              min={0}
              max={2}
              value={extraFields?.temperature ?? ""}
              onChange={(e) => onFieldChange("temperature", e.target.value ? Number(e.target.value) : undefined)}
              className="w-14 px-1.5 py-0.5 text-[10px] bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#4e4e4e] placeholder:text-[#bbb] focus:outline-none focus:border-black/15"
            />
            <input
              type="text"
              placeholder={extraFields?.thirdFieldPlaceholder ?? ""}
              value={extraFields?.thirdField ?? ""}
              onChange={(e) => {
                const key = extraFields?.thirdFieldKey;
                if (key) onFieldChange(key, e.target.value || undefined);
              }}
              className="flex-1 min-w-0 w-24 px-1.5 py-0.5 text-[10px] bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#4e4e4e] placeholder:text-[#bbb] focus:outline-none focus:border-black/15"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#aaa]">Fallbacks</p>
            <div className="flex flex-wrap gap-1">
              {(extraFields?.fallback_models ?? []).map((fm) => (
                <span
                  key={fm}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#777169]"
                >
                  {fm}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (extraFields?.fallback_models ?? []).filter((m) => m !== fm);
                      onFieldChange("fallback_models", updated.length > 0 ? updated : undefined);
                    }}
                    className="text-[#aaa] hover:text-red-600/80 transition-colors cursor-pointer leading-none"
                    aria-label={`Remove fallback ${fm}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {(() => {
                const current = extraFields?.fallback_models ?? [];
                const choices = availableModels.filter((m) => m !== model && !current.includes(m));
                if (choices.length === 0) return null;
                return (
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      onFieldChange("fallback_models", [...current, e.target.value]);
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#777169] focus:outline-none focus:border-black/15 cursor-pointer"
                  >
                    <option value="" className="bg-white">+ add fallback</option>
                    {choices.map((m) => (
                      <option key={m} value={m} className="bg-white">{m}</option>
                    ))}
                  </select>
                );
              })()}
            </div>
          </div>
          {extraFields?.supportsUltrawork && (
            <div className="space-y-1 pt-1 border-t border-[#e5e5e5]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#aaa]">Ultrawork</p>
                {hasUltraworkValues && (
                  <button
                    type="button"
                    onClick={() => onFieldChange("ultrawork", undefined)}
                    className="text-[10px] text-[#aaa] hover:text-red-600/80 transition-colors cursor-pointer"
                  >
                    clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={extraFields.ultrawork?.model ?? ""}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    onFieldChange("ultrawork", {
                      ...extraFields?.ultrawork,
                      model: value,
                    });
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] font-mono bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#4e4e4e] focus:outline-none focus:border-black/15 cursor-pointer"
                >
                  <option value="" className="bg-white">select model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m} className="bg-white">{m}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="variant"
                  value={extraFields.ultrawork?.variant ?? ""}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    onFieldChange("ultrawork", {
                      ...extraFields?.ultrawork,
                      variant: value,
                    });
                  }}
                  className="w-16 px-1.5 py-0.5 text-[10px] bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#4e4e4e] placeholder:text-[#bbb] focus:outline-none focus:border-black/15"
                />
                <input
                  type="number"
                  placeholder="temp"
                  step={0.1}
                  min={0}
                  max={2}
                  value={extraFields.ultrawork?.temperature ?? ""}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : undefined;
                    onFieldChange("ultrawork", {
                      ...extraFields?.ultrawork,
                      temperature: value,
                    });
                  }}
                  className="w-14 px-1.5 py-0.5 text-[10px] bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[#4e4e4e] placeholder:text-[#bbb] focus:outline-none focus:border-black/15"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {open && (
        <div
          className={`absolute z-[9999] w-72 max-h-64 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_8px] ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          } left-0`}
        >
          <div className="p-2 border-b border-[#e5e5e5]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full px-2.5 py-1.5 text-xs bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg text-black placeholder:text-[#aaa] focus:outline-none focus:border-black/20"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            <button
              type="button"
              onClick={() => {
                onSelect(undefined);
                setOpen(false);
                setSearch("");
              }}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors hover:bg-[#f0f0f0] ${
                !isOverride ? "text-[#4e4e4e] bg-[#f5f5f5]" : "text-[#777169]"
              }`}
            >
              Auto (default)
            </button>
            {groupedFilteredModels.map((group) => (
              <div key={group.provider} className="border-t border-white/5 first:border-t-0">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#aaa]">
                  {group.provider}
                </div>
                {group.models.map((providerModel) => (
                  <button
                    key={providerModel}
                    type="button"
                    onClick={() => {
                      onSelect(providerModel);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-mono transition-colors hover:bg-[#f0f0f0] ${
                      isOverride && model === providerModel
                        ? "text-[#4e4e4e] bg-[#f5f5f5]"
                        : "text-[#4e4e4e]"
                    }`}
                  >
                    <span className="flex-1">{providerModel}</span>
                  </button>
                ))}
              </div>
            ))}
            {groupedFilteredModels.length === 0 && (
              <div className="px-3 py-2 text-xs text-[#aaa]">No models found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
