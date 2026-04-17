"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface FetchedModel {
  id: string;
  selected: boolean;
}

interface ModelDiscoveryProps {
  canFetchModels: boolean;
  fetchingModels: boolean;
  saving: boolean;
  fetchedModels: FetchedModel[];
  showFetchedModels: boolean;
  onFetchModels: () => void;
  onToggleFetchedModel: (id: string) => void;
  onToggleAllFetchedModels: () => void;
  onAddSelectedModels: () => void;
}

export function ModelDiscovery({
  canFetchModels,
  fetchingModels,
  saving,
  fetchedModels,
  showFetchedModels,
  onFetchModels,
  onToggleFetchedModel,
  onToggleAllFetchedModels,
  onAddSelectedModels,
}: ModelDiscoveryProps) {
  const t = useTranslations("providers");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{t("discoveryLabel")}</span>
        <Button
          variant="secondary"
          onClick={onFetchModels}
          disabled={!canFetchModels || fetchingModels || saving}
          className="px-3 py-1.5 text-xs"
        >
          {fetchingModels ? (
            <span className="flex items-center gap-2">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t("discoveryFetchingButton")}
            </span>
          ) : t("discoveryFetchButton")}
        </Button>
      </div>
      {showFetchedModels && fetchedModels.length > 0 && (
        <div className="bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{t("discoveryAvailableModels", { count: fetchedModels.length })}</span>
              <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-hover)] px-2 py-0.5 rounded">
                {t("discoverySelected", { count: fetchedModels.filter(m => m.selected).length })}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleAllFetchedModels}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {fetchedModels.every(m => m.selected) ? t("discoveryDeselectAll") : t("discoverySelectAll")}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 mb-3">
            {fetchedModels.map((model) => (
              <label key={model.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--surface-hover)] rounded px-2 py-1.5 transition-colors">
                <input
                  type="checkbox"
                  checked={model.selected}
                  onChange={() => onToggleFetchedModel(model.id)}
                  className="w-4 h-4 rounded border-[var(--surface-border)] bg-[var(--surface-muted)] checked:bg-blue-500/100 focus:ring-2 focus:ring-blue-500/50"
                />
                <span className="text-sm text-[var(--text-secondary)]">{model.id}</span>
              </label>
            ))}
          </div>
          <Button
            onClick={onAddSelectedModels}
            disabled={fetchedModels.filter(m => m.selected).length === 0}
            className="w-full"
          >
            {t("discoveryAddSelected", { count: fetchedModels.filter(m => m.selected).length })}
          </Button>
        </div>
      )}
      <p className="text-xs text-[var(--text-muted)] mb-2">{t("discoveryManualHint")}</p>
    </div>
  );
}
