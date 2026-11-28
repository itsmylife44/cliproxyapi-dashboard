"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo, useRef } from "react";
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
  excludedModels: string[];
  onSelectionChange: (excludedModels: string[]) => void;
  isLocked?: boolean;
}

type SaveStatus = "saving" | "saved" | null;
const SAVE_DELAY_MS = 500;
const SAVED_NOTICE_MS = 2000;

export function ModelSelector({
  availableModels,
  modelSourceMap,
  modelProvidersMap,
  excludedModels: excludedModelIds,
  onSelectionChange,
  isLocked = false,
}: ModelSelectorProps) {
  const t = useTranslations("modelSelector");
  const tCommon = useTranslations("common");
  const excludedModels = useMemo(() => new Set(excludedModelIds), [excludedModelIds]);
  const [isOpen, setIsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<ModelProviderName>>(() => new Set());
  const [pendingSave, setPendingSave] = useState<string[] | null>(null);
  const writes = useRef(Promise.resolve());
  const modelGroups = useMemo(
    () => groupModelsByProvider(availableModels, modelSourceMap),
    [availableModels, modelSourceMap]
  );

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

  const selectedCount = availableModels.reduce((count, model) => count + Number(!excludedModels.has(model)), 0);

  const changeSelection = (models: string[], selected: boolean) => {
    const next = new Set(excludedModels);
    for (const model of models) {
      if (selected) next.delete(model);
      else next.add(model);
    }
    if (next.size === excludedModels.size) return;
    const selection = Array.from(next);
    onSelectionChange(selection);
    setPendingSave(selection);
  };

  useEffect(() => {
    if (isLocked || pendingSave !== excludedModelIds) return;
    const notice = new AbortController();
    let savedTimer: ReturnType<typeof setTimeout> | undefined;
    const saveTimer = setTimeout(() => {
      setSaveStatus("saving");
      writes.current = writes.current.then(async () => {
        if (notice.signal.aborted) return;
        let saved = false;
        try {
          const response = await fetch(API_ENDPOINTS.MODEL_PREFERENCES, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ excludedModels: pendingSave }),
          });
          saved = response.ok;
        } catch {
          // Keep the selection available for this session if it could not be saved.
        }
        if (notice.signal.aborted) return;
        setSaveStatus(saved ? "saved" : null);
        if (saved) savedTimer = setTimeout(() => setSaveStatus(null), SAVED_NOTICE_MS);
      });
    }, SAVE_DELAY_MS);
    return () => {
      notice.abort();
      clearTimeout(saveTimer);
      clearTimeout(savedTimer);
    };
  }, [excludedModelIds, isLocked, pendingSave]);

  return (
    <div>
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
            {pendingSave === excludedModelIds && saveStatus === "saving" && (
              <span className="text-xs text-[var(--text-muted)]">{t("saving")}</span>
            )}
            {pendingSave === excludedModelIds && saveStatus === "saved" && (
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

      {!isLocked && isOpen && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => changeSelection(availableModels, true)}
              className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("selectAll")}
            </button>
            <span className="text-[var(--surface-border)]">|</span>
            <button
              type="button"
              onClick={() => changeSelection(availableModels, false)}
              className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("deselectAll")}
            </button>
          </div>

          <div className="max-h-72 divide-y divide-[var(--surface-border)] overflow-y-auto border-t border-b border-[var(--surface-border)]">
            {modelGroups.map((group) => {
              const groupSelectedCount = group.models.reduce((count, model) => count + Number(!excludedModels.has(model)), 0);
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
                        onClick={() => changeSelection(group.models, true)}
                        className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("selectAllGroup")}
                      </button>
                      <span className="text-[var(--surface-border)]">|</span>
                      <button
                        type="button"
                        onClick={() => changeSelection(group.models, false)}
                        className="font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("deselectAllGroup")}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 grid grid-cols-1 gap-1.5 pl-4 sm:grid-cols-2 md:grid-cols-3">
                      {group.models.map((modelId) => {
                        const isChecked = !excludedModels.has(modelId);
                        const providers = modelProvidersMap?.get(modelId);
                        return (
                          <label
                            key={modelId}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-[var(--surface-hover)]"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => changeSelection([modelId], !isChecked)}
                              className="size-3.5 shrink-0 cursor-pointer rounded border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--text-primary)]/20 focus:ring-offset-0 disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-xs text-[var(--text-secondary)]">
                                {modelId}
                              </span>
                              {!!providers?.length && (
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
