"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfigField, Select, Toggle } from "@/components/config/config-fields";
import {
  diffPluginConfig,
  toPluginConfigDraft,
  type PluginConfigField,
  type PluginConfigFieldError,
} from "@/lib/plugin-config";

interface PluginConfigFormProps {
  fields: PluginConfigField[];
  /** GET /plugins/:id/config */
  config: Record<string, unknown>;
  busy: boolean;
  /** Called with the PATCH body; only when something changed and every field is valid. */
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
}

/** Settings form built from a loaded plugin's `config_fields`. */
export function PluginConfigForm({ fields, config, busy, onSave, onCancel }: PluginConfigFormProps) {
  const t = useTranslations("settings.plugins");
  const [draft, setDraft] = useState(() => toPluginConfigDraft(fields, config));
  const [errors, setErrors] = useState<Record<string, PluginConfigFieldError>>({});
  const [unchanged, setUnchanged] = useState(false);

  if (fields.length === 0) return null;

  const updateDraftField = (name: string, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setUnchanged(false);
  };

  const submitChanges = () => {
    const result = diffPluginConfig(fields, config, draft);
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    if (Object.keys(result.patch).length === 0) {
      setUnchanged(true);
      return;
    }
    onSave(result.patch);
  };

  const renderFieldInput = (field: PluginConfigField) => {
    const value = draft[field.name];
    switch (field.type) {
      case "boolean":
        return <Toggle enabled={value === true} disabled={busy} onChange={(next) => updateDraftField(field.name, next)} />;
      case "enum":
        return (
          <Select
            value={String(value)}
            disabled={busy}
            onChange={(next) => updateDraftField(field.name, next)}
            options={[{ value: "", label: t("configUnset") }, ...field.enumValues.map((v) => ({ value: v, label: v }))]}
          />
        );
      case "array":
      case "object":
        return (
          <textarea
            value={String(value)}
            disabled={busy}
            onChange={(e) => updateDraftField(field.name, e.target.value)}
            spellCheck={false}
            aria-invalid={errors[field.name] !== undefined}
            className="h-28 w-full rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 font-mono text-xs text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400/30 transition-colors resize-y"
          />
        );
      default:
        return (
          <Input
            name={`plugin-config-${field.name}`}
            value={String(value)}
            disabled={busy}
            onChange={(next) => updateDraftField(field.name, next)}
            spellCheck={false}
          />
        );
    }
  };

  return (
    <div className="space-y-4 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)]/40 p-4">
      <p className="text-xs text-[var(--text-muted)]">{t("configEmptyHint")}</p>
      {fields.map((field) => (
        <ConfigField key={field.name} label={field.name} description={field.description || undefined}>
          {renderFieldInput(field)}
          {errors[field.name] && (
            <p role="alert" className="mt-1 text-xs text-red-600">{t(`configErrors.${errors[field.name]}`)}</p>
          )}
        </ConfigField>
      ))}
      {unchanged && <p className="text-xs text-[var(--text-muted)]">{t("configNoChanges")}</p>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={submitChanges}>{t("configSave")}</Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>{t("configCancel")}</Button>
      </div>
    </div>
  );
}
