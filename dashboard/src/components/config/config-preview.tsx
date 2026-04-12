"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/config/config-fields";

interface ConfigPreviewProps {
  rawJson: string;
}

export default function ConfigPreview({ rawJson }: ConfigPreviewProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const t = useTranslations("config");

  return (
    <section className="space-y-3 rounded-md border border-rose-500/20 bg-rose-500/10 p-4">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <SectionHeader title={t("advancedRawJsonEditor")} />
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs"
        >
          {showAdvanced ? t("hide") : t("show")} {t("rawJson")}
        </Button>
      </div>
      {showAdvanced && (
        <div className="space-y-4">
          <div className="rounded-sm border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">
            <strong>{t("warning")}</strong>{" "}
            <span>{t("warningRawEditorText")}</span>
          </div>
          <textarea
            value={rawJson}
            readOnly
            className="h-96 w-full rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 font-mono text-xs text-[var(--text-primary)] focus:border-blue-400/50 focus:outline-none"
            spellCheck={false}
          />
          <p className="text-xs text-[var(--text-muted)]">
            {t("readOnlyViewDescription")}
          </p>
        </div>
      )}
    </section>
  );
}
