"use client";

import { useState, useEffect, useRef } from "react";
import {
  MODEL_PROVIDER_ORDER,
  type ModelProviderName,
  groupModelsByProvider,
} from "@/lib/providers/model-grouping";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { HelpTooltip } from "@/components/ui/tooltip";

interface ModelSelectorProps {
  availableModels: string[];
  modelSourceMap: Map<string, string>;
  modelProvidersMap?: Map<string, string[]>;
  initialExcludedModels: string[];
  onSelectionChange: (excludedModels: string[]) => void;
  isLocked?: boolean;
}

const SAVE_STATUS = {
  IDLE: "idle",
  SAVING: "saving",
  SAVED: "saved",
} as const;

type SaveStatus = (typeof SAVE_STATUS)[keyof typeof SAVE_STATUS];

function buildExcludedSignature(models: Iterable<string>): string {
  return JSON.stringify(Array.from(models).sort((a, b) => a.localeCompare(b)));
}

export function ModelSelector({
  availableModels,
  modelSourceMap,
  modelProvidersMap,
  initialExcludedModels,
  onSelectionChange,
  isLocked = false,
}: ModelSelectorProps) {
  const [excludedModels, setExcludedModels] = useState<Set<string>>(
    () => new Set(initialExcludedModels)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SAVE_STATUS.IDLE);
  const [expandedGroups, setExpandedGroups] = useState<Set<ModelProviderName>>(
    () => new Set(MODEL_PROVIDER_ORDER)
  );
  const isFirstRender = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string>(buildExcludedSignature(initialExcludedModels));

  useEffect(() => {
    const incoming = new Set(initialExcludedModels);
    if (buildExcludedSignature(incoming) !== buildExcludedSignature(excludedModels)) {
      setExcludedModels(incoming);
      lastSavedSignatureRef.current = buildExcludedSignature(incoming);
      onSelectionChange(Array.from(incoming));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExcludedModels]);

  const modelGroups = groupModelsByProvider(availableModels, modelSourceMap);

  const toggleGroupExpansion = (provider: ModelProviderName) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const selectedCount = availableModels.length - excludedModels.size;

  const handleToggle = (modelId: string) => {
    setExcludedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      onSelectionChange(Array.from(next));
      return next;
    });
  };

  const handleSelectAll = () => {
    setExcludedModels(new Set());
    onSelectionChange([]);
  };

  const handleDeselectAll = () => {
    const allModels = new Set(availableModels);
    setExcludedModels(allModels);
    onSelectionChange(Array.from(allModels));
  };

  const handleGroupSelectAll = (groupModels: string[]) => {
    setExcludedModels((prev) => {
      const next = new Set(prev);
      for (const model of groupModels) {
        next.delete(model);
      }
      onSelectionChange(Array.from(next));
      return next;
    });
  };

  const handleGroupDeselectAll = (groupModels: string[]) => {
    setExcludedModels((prev) => {
      const next = new Set(prev);
      for (const model of groupModels) {
        next.add(model);
      }
      onSelectionChange(Array.from(next));
      return next;
    });
  };

  useEffect(() => {
    const currentSignature = buildExcludedSignature(excludedModels);

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (currentSignature === lastSavedSignatureRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus(SAVE_STATUS.SAVING);
      
      const saveData = async () => {
        try {
          const response = await fetch(API_ENDPOINTS.MODEL_PREFERENCES, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              excludedModels: Array.from(excludedModels),
            }),
          });

          if (response.ok) {
            lastSavedSignatureRef.current = currentSignature;
            setSaveStatus(SAVE_STATUS.SAVED);
            savedTimeoutRef.current = setTimeout(() => {
              setSaveStatus(SAVE_STATUS.IDLE);
            }, 2000);
          } else {
            setSaveStatus(SAVE_STATUS.IDLE);
          }
        } catch {
          setSaveStatus(SAVE_STATUS.IDLE);
        }
      };

      void saveData();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, [excludedModels]);

  return (
    <div
      className="rounded-lg border border-[#e5e5e5] bg-white"
      data-testid="model-selector"
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className="flex items-center gap-2 text-xs font-medium text-[#777169] hover:text-black transition-colors"
            disabled={isLocked}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-sm font-semibold text-black">
              Model Selection <HelpTooltip content="Deselect models to exclude them from your config. Excluded models won't appear in opencode.json or be assigned to agents." />
            </span>
            {isLocked && (
              <span className="text-amber-600" title="Locked by subscription">
                🔒
              </span>
            )}
          </button>

          <span className="px-2 py-0.5 rounded-full bg-[#f0f0f0] text-xs text-[#777169]">
            {selectedCount} of {availableModels.length} selected
          </span>
        </div>

        {isLocked ? (
          <span className="text-xs text-amber-600/80">
            Publisher-controlled
          </span>
        ) : (
          <>
            {saveStatus === SAVE_STATUS.SAVING && (
              <span className="text-xs text-[#777169]">Saving...</span>
            )}
            {saveStatus === SAVE_STATUS.SAVED && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-label="Saved"
                >
                  <title>Saved</title>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </span>
            )}
          </>
        )}
      </div>

      {isOpen && (
        <div className="space-y-4 px-4 pb-4">
          {isLocked && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-lg">🔒</span>
              <p className="text-sm text-amber-700">
                Model selection is controlled by your publisher. Unsubscribe to regain control.
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-[#777169] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              Select All
            </button>
            <span className="text-[#aaa]">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs font-medium text-[#777169] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              Deselect All
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-4">
            {modelGroups.map((group) => {
              const groupSelectedCount = group.models.filter(
                (model) => !excludedModels.has(model)
              ).length;
              const groupTotalCount = group.models.length;
              const isExpanded = expandedGroups.has(group.provider);

              return (
                <div key={group.provider} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleGroupExpansion(group.provider)}
                      aria-expanded={isExpanded}
                      className="flex items-center gap-2 text-sm font-semibold text-black hover:text-black transition-colors"
                    >
                      <svg
                        width="12"
                        height="12"
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
                      {group.provider}
                      <span className="px-2 py-0.5 rounded-full bg-[#f0f0f0] text-xs font-normal text-[#777169]">
                        {groupSelectedCount}/{groupTotalCount} selected
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleGroupSelectAll(group.models)}
                          className="text-xs font-medium text-[#777169] hover:text-[#4e4e4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isLocked}
                        >
                          Select all
                        </button>
                        <span className="text-[#bbb]">|</span>
                        <button
                          type="button"
                          onClick={() => handleGroupDeselectAll(group.models)}
                          className="text-xs font-medium text-[#777169] hover:text-[#4e4e4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isLocked}
                        >
                          Deselect all
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {group.models.map((modelId) => {
                        const isChecked = !excludedModels.has(modelId);
                        const providers = modelProvidersMap?.get(modelId) ?? [];
                        const hasMultipleProviders = providers.length > 1;
                        return (
                          <label
                            key={modelId}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] ${
                              isLocked
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer group hover:bg-[#f5f5f5] hover:border-[#e5e5e5]"
                            } transition-colors`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggle(modelId)}
                              disabled={isLocked}
                              className="size-4 shrink-0 rounded border-[#ddd] bg-[#f5f5f5] text-black focus:ring-2 focus:ring-black/20 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0 flex-1">
                              <span className={`font-mono text-xs ${
                                isLocked ? "text-[#777169]" : "text-[#4e4e4e] group-hover:text-black"
                              } transition-colors truncate block`}>
                                {modelId}
                              </span>
                              {hasMultipleProviders && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {providers.map((p) => (
                                    <span key={p} className="inline-block rounded-sm bg-[#f5f5f5] border border-[#e5e5e5] px-1 py-px text-[9px] text-[#999]">
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
