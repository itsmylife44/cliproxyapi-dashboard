"use client";

import { useState, useEffect, useRef } from "react";

interface ModelSelectorProps {
  availableModels: string[];
  modelSourceMap: Map<string, string>;
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

const PROVIDER_ORDER = [
  "Claude",
  "Gemini",
  "Antigravity",
  "OpenAI/Codex",
  "OpenAI-Compatible",
  "Other",
] as const;

type ProviderName = (typeof PROVIDER_ORDER)[number];

interface ModelGroup {
  provider: ProviderName;
  models: string[];
}

function buildExcludedSignature(models: Iterable<string>): string {
  return JSON.stringify(Array.from(models).sort((a, b) => a.localeCompare(b)));
}

function detectProvider(modelId: string, sourceMap?: Map<string, string>): ProviderName {
  // Prefer explicit source metadata
  const source = sourceMap?.get(modelId);
  if (source && PROVIDER_ORDER.includes(source as ProviderName)) {
    return source as ProviderName;
  }

  // Fallback to heuristic detection
  const lower = modelId.toLowerCase();
  
  if (lower.startsWith("claude-")) return "Claude";
  if (lower.startsWith("gemini-")) return "Gemini";
  if (
    lower.startsWith("gpt-") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("o4") ||
    lower.includes("codex")
  ) {
    return "OpenAI/Codex";
  }
  if (
    lower.startsWith("openrouter/") ||
    lower.startsWith("groq/") ||
    lower.startsWith("xai/") ||
    lower.startsWith("deepseek/") ||
    lower.startsWith("anthropic/") ||
    lower.startsWith("google/")
  ) {
    return "OpenAI-Compatible";
  }
  
  return "Other";
}

function groupModelsByProvider(models: string[], sourceMap?: Map<string, string>): ModelGroup[] {
  const grouped = new Map<ProviderName, string[]>();
  
  for (const model of models) {
    const provider = detectProvider(model, sourceMap);
    const existing = grouped.get(provider) || [];
    existing.push(model);
    grouped.set(provider, existing);
  }
  
  // Sort models within each group alphabetically
  for (const models of grouped.values()) {
    models.sort((a, b) => a.localeCompare(b));
  }
  
  // Return in fixed provider order
  return PROVIDER_ORDER.map((provider) => ({
    provider,
    models: grouped.get(provider) || [],
  })).filter((group) => group.models.length > 0);
}

export function ModelSelector({
  availableModels,
  modelSourceMap,
  initialExcludedModels,
  onSelectionChange,
  isLocked = false,
}: ModelSelectorProps) {
  const [excludedModels, setExcludedModels] = useState<Set<string>>(
    () => new Set(initialExcludedModels)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SAVE_STATUS.IDLE);
  const [expandedGroups, setExpandedGroups] = useState<Set<ProviderName>>(
    () => new Set(PROVIDER_ORDER)
  );
  const isFirstRender = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string>(buildExcludedSignature(initialExcludedModels));

  const modelGroups = groupModelsByProvider(availableModels, modelSourceMap);

  const toggleGroupExpansion = (provider: ProviderName) => {
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
    onSelectionChange(availableModels);
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

    if (currentSignature === lastSavedSignatureRef.current) {
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
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
          const response = await fetch("/api/model-preferences", {
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
      className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl"
      data-testid="model-selector"
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
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
            <span className="text-sm font-semibold text-white">
              Model Selection
            </span>
            {isLocked && (
              <span className="text-amber-400" title="Locked by subscription">
                🔒
              </span>
            )}
          </button>

          <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/50">
            {selectedCount} of {availableModels.length} selected
          </span>
        </div>

        {isLocked ? (
          <span className="text-xs text-amber-400/80">
            Publisher-controlled
          </span>
        ) : (
          <>
            {saveStatus === SAVE_STATUS.SAVING && (
              <span className="text-xs text-white/50">Saving...</span>
            )}
            {saveStatus === SAVE_STATUS.SAVED && (
              <span className="flex items-center gap-1 text-xs text-green-400">
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
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
              <span className="text-lg">🔒</span>
              <p className="text-sm text-amber-200/90">
                Model selection is controlled by your publisher. Unsubscribe to regain control.
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-white/60 hover:text-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              Select All
            </button>
            <span className="text-white/30">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs font-medium text-white/60 hover:text-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
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
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-normal text-white/50">
                        {groupSelectedCount}/{groupTotalCount} selected
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleGroupSelectAll(group.models)}
                          className="text-xs font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isLocked}
                        >
                          Select all
                        </button>
                        <span className="text-white/20">|</span>
                        <button
                          type="button"
                          onClick={() => handleGroupDeselectAll(group.models)}
                          className="text-xs font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        return (
                          <label
                            key={modelId}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 ${
                              isLocked
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer group hover:bg-white/8 hover:border-white/15"
                            } transition-all`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggle(modelId)}
                              disabled={isLocked}
                              className="size-4 shrink-0 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className={`font-mono text-xs ${
                              isLocked ? "text-white/50" : "text-white/70 group-hover:text-white/90"
                            } transition-colors truncate`}>
                              {modelId}
                            </span>
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
