"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/config/config-fields";

interface ConfigPreviewProps {
  rawJson: string;
}

export default function ConfigPreview({ rawJson }: ConfigPreviewProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-4">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <SectionHeader title="Advanced: Raw JSON Editor" />
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs"
        >
          {showAdvanced ? "Hide" : "Show"} Raw JSON
        </Button>
      </div>
      {showAdvanced && (
        <div className="space-y-4">
          <div className="rounded-sm border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <strong>Warning:</strong>{" "}
            <span>
              This section shows the complete configuration including fields managed on other pages.
              Only edit this if you know what you&apos;re doing. Changes here will NOT be saved from this editor.
            </span>
          </div>
          <textarea
            value={rawJson}
            readOnly
            className="h-96 w-full rounded-sm border border-[#e5e5e5] bg-white p-4 font-mono text-xs text-black focus:border-blue-400/50 focus:outline-none"
            spellCheck={false}
          />
          <p className="text-xs text-[#777169]">
            This is a read-only view of the full configuration. Use the structured forms above to make changes.
          </p>
        </div>
      )}
    </section>
  );
}
