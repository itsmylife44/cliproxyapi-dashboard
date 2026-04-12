"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExcludedModelsProps {
  excludedModels: string[];
  excludedModelIds: number[];
  saving: boolean;
  onAddExcludedModel: () => void;
  onRemoveExcludedModel: (index: number) => void;
  onUpdateExcludedModel: (index: number, value: string) => void;
}

export function ExcludedModels({
  excludedModels,
  excludedModelIds,
  saving,
  onAddExcludedModel,
  onRemoveExcludedModel,
  onUpdateExcludedModel,
}: ExcludedModelsProps) {
  const t = useTranslations("providers");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="excludedModels" className="text-sm font-semibold text-[var(--text-primary)]">{t("excludedModelsLabel")}</label>
        <Button variant="ghost" onClick={onAddExcludedModel} className="px-3 py-1.5 text-xs" disabled={saving}>
          {t("addExclusionButton")}
        </Button>
      </div>
      {excludedModels.length > 0 && (
        <div className="space-y-2">
          {excludedModels.map((pattern, idx) => (
            <div key={excludedModelIds[idx]} className="flex gap-2">
              <Input
                type="text"
                name={`excluded-${idx}`}
                value={pattern}
                onChange={(val) => onUpdateExcludedModel(idx, val)}
                placeholder={t("excludedModelPlaceholder")}
                disabled={saving}
                className="flex-1"
              />
              <Button variant="danger" onClick={() => onRemoveExcludedModel(idx)} className="px-3 shrink-0" disabled={saving}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
      {excludedModels.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">{t("excludedModelsHint")}</p>
      )}
    </div>
  );
}
