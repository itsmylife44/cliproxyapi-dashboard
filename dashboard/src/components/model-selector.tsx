"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useRef } from "react";
import {
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
  const t = useTranslations("modelSelector");
  const tCommon = useTranslations("common");
  const [excludedModels, setExcludedModels] = useState<Set<string>>(
    () => new Set(initialExcludedModels)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SAVE_STATUS.IDLE);
  const [expandedGroups, setExpandedGroups] = useState<Set<ModelProviderName>>(() => new Set());
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
      data-testid="model-selector"
    >
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
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
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {t("title")} <HelpTooltip content={t("tooltip")} />
            </span>
            {isLocked && (
              <span className="text-amber-600" title={t("lockedBySubscription")}>
                🔒
              </span>
            )}
          </button>

          <span className="px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-xs text-[var(--text-muted)]">
            {t("selectedCount", { selected: selectedCount, total: availableModels.length })}
          </span>
        </div>

        {isLocked ? (
          <span className="text-xs text-amber-600/80">
            {t("publisherControlled")}
          </span>
        ) : (
          <>
            {saveStatus === SAVE_STATUS.SAVING && (
              <span className="text-xs text-[var(--text-muted)]">{t("saving")}</span>
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
                  aria-label={tCommon("savedAriaLabel")}
                >
                  <title>{t("saved")}</title>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t("saved")}
              </span>
            )}
          </>
        )}
      </div>

      {isOpen && (
        <div className="space-y-3 pt-2">
          {isLocked && (
            <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5">
              <span className="text-sm">🔒</span>
              <p className="text-xs text-amber-700">
                {t("lockedMessage")}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLocked}
            >
              {t("selectAll")}
            </button>
            <span className="text-[var(--surface-border)]">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLocked}
            >
              {t("deselectAll")}
            </button>
          </div>

          <div className="max-h-72 divide-y divide-[var(--surface-border)] overflow-y-auto border-t border-b border-[var(--surface-border)]">
            {modelGroups.map((group) => {
              const groupSelectedCount = group.models.filter(
                (model) => !excludedModels.has(model)
              ).length;
              const groupTotalCount = group.models.length;
              const isExpanded = expandedGroups.has(group.provider);

              return (
                <div key={group.provider} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGroupExpansion(group.provider)}
                      aria-expanded={isExpanded}
                      className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--text-secondary)]"
                    >
                      <svg
                        width="11"
                        height="11"
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
                      <span>{group.provider}</span>
                      <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-[var(--text-muted)]">
                        {t("groupSelectedCount", { selected: groupSelectedCount, total: groupTotalCount })}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleGroupSelectAll(group.models)}
                        className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLocked}
                      >
                        {t("selectAllGroup")}
                      </button>
                      <span className="text-[var(--surface-border)]">|</span>
                      <button
                        type="button"
                        onClick={() => handleGroupDeselectAll(group.models)}
                        className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLocked}
                      >
                        {t("deselectAllGroup")}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 grid grid-cols-1 gap-1.5 pl-4 sm:grid-cols-2 md:grid-cols-3">
                      {group.models.map((modelId) => {
                        const isChecked = !excludedModels.has(modelId);
                        const providers = modelProvidersMap?.get(modelId) ?? [];
                        const hasMultipleProviders = providers.length > 1;
                        return (
                          <label
                            key={modelId}
                            className={`flex items-center gap-2 rounded px-2 py-1 transition-colors ${
                              isLocked
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer hover:bg-[var(--surface-hover)]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggle(modelId)}
                              disabled={isLocked}
                              className="size-3.5 shrink-0 cursor-pointer rounded border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--text-primary)]/20 focus:ring-offset-0 disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0 flex-1">
                              <span className={`font-mono text-xs ${
                                isLocked ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                              } transition-colors truncate block`}>
                                {modelId}
                              </span>
                              {hasMultipleProviders && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {providers.map((p) => (
                                    <span key={p} className="inline-block rounded-sm bg-[var(--surface-muted)] border border-[var(--surface-border)] px-1 py-px text-[9px] text-[var(--text-muted)]">
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
