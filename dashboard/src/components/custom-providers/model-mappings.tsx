"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ModelMapping {
  _id: number;
  upstreamName: string;
  alias: string;
}

interface ModelMappingsProps {
  models: ModelMapping[];
  saving: boolean;
  error: string;
  onAddModelMapping: () => void;
  onRemoveModelMapping: (index: number) => void;
  onUpdateModelMapping: (index: number, field: "upstreamName" | "alias", value: string) => void;
}

export function ModelMappings({
  models,
  saving,
  error,
  onAddModelMapping,
  onRemoveModelMapping,
  onUpdateModelMapping,
}: ModelMappingsProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="models" className="text-sm font-semibold text-[var(--text-primary)]">
          Model Mappings <span className="text-red-500">*</span>
        </label>
        <Button variant="ghost" onClick={onAddModelMapping} className="px-3 py-1.5 text-xs" disabled={saving}>
          + Add Model
        </Button>
      </div>
      <div className="space-y-2">
        {models.map((model, idx) => (
          <div key={model._id} className="flex gap-2">
            <Input
              type="text"
              name={`model-upstream-${idx}`}
              value={model.upstreamName}
              onChange={(val) => onUpdateModelMapping(idx, "upstreamName", val)}
              placeholder="gpt-4"
              disabled={saving}
              className="flex-1"
            />
            <Input
              type="text"
              name={`model-alias-${idx}`}
              value={model.alias}
              onChange={(val) => onUpdateModelMapping(idx, "alias", val)}
              placeholder="custom-gpt-4"
              disabled={saving}
              className="flex-1"
            />
            {models.length > 1 && (
              <Button variant="danger" onClick={() => onRemoveModelMapping(idx)} className="px-3 shrink-0" disabled={saving}>
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      {!error && <p className="mt-1.5 text-xs text-[var(--text-muted)]">Map upstream model names to aliases</p>}
    </div>
  );
}
