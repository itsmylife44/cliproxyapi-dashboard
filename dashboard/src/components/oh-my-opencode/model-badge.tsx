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

export interface ExtraFieldConfig {
  variant?: string;
  temperature?: number;
  thirdField?: string;
  thirdFieldKey: string;
  thirdFieldPlaceholder: string;
}

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
  onFieldChange?: (field: string, value: string | number | undefined) => void;
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

  const hasExtraValues =
    extraFields && (extraFields.variant || extraFields.temperature !== undefined || extraFields.thirdField);

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
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-l-lg text-xs font-mono cursor-pointer transition-all hover:bg-white/10 ${
            isOverride
              ? "bg-violet-500/10 border border-violet-400/20 text-white/80"
              : "bg-white/5 border border-white/10 text-white/70"
          }`}
        >
          {showName && (
            <>
              <span className="text-pink-300">{name}</span>
              <span className="text-white/30">&rarr;</span>
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
            className={`px-1.5 py-1 border border-l-0 rounded-r-lg text-[10px] transition-all cursor-pointer ${
              showExtra || hasExtraValues
                ? "bg-amber-500/10 border-amber-400/20 text-amber-300/80 hover:bg-amber-500/20"
                : "bg-white/5 border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10"
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
        <div className="flex items-center gap-1.5 mt-1 ml-0.5">
          <input
            type="text"
            placeholder="variant"
            value={extraFields?.variant ?? ""}
            onChange={(e) => onFieldChange("variant", e.target.value || undefined)}
            className="w-16 px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/30"
          />
          <input
            type="number"
            placeholder="temp"
            step={0.1}
            min={0}
            max={2}
            value={extraFields?.temperature ?? ""}
            onChange={(e) => onFieldChange("temperature", e.target.value ? Number(e.target.value) : undefined)}
            className="w-14 px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/30"
          />
          <input
            type="text"
            placeholder={extraFields?.thirdFieldPlaceholder ?? ""}
            value={extraFields?.thirdField ?? ""}
            onChange={(e) => onFieldChange(extraFields?.thirdFieldKey ?? "", e.target.value || undefined)}
            className="flex-1 min-w-0 w-24 px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/30"
          />
        </div>
      )}

      {open && (
        <div
          className={`absolute z-[9999] w-72 max-h-64 overflow-hidden rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-2xl ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          } left-0`}
        >
          <div className="p-2 border-b border-white/10">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-400/40"
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
              className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors hover:bg-white/10 ${
                !isOverride ? "text-violet-300 bg-violet-500/10" : "text-white/60"
              }`}
            >
              Auto (default)
            </button>
            {groupedFilteredModels.map((group) => (
              <div key={group.provider} className="border-t border-white/5 first:border-t-0">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
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
                    className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-mono transition-colors hover:bg-white/10 ${
                      isOverride && model === providerModel
                        ? "text-violet-300 bg-violet-500/10"
                        : "text-white/70"
                    }`}
                  >
                    <span className="flex-1">{providerModel}</span>
                  </button>
                ))}
              </div>
            ))}
            {groupedFilteredModels.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/30">No models found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
