"use client";

import { CopyBlock } from "@/components/copy-block";
import { Button } from "@/components/ui/button";

interface ConfigPreviewProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  configJson: string;
  onDownload: () => void;
  downloadFilename: string;
}

export function ConfigPreview({
  isExpanded,
  onToggleExpanded,
  configJson,
  onDownload,
  downloadFilename,
}: ConfigPreviewProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center gap-2 text-xs font-medium text-[#777169] hover:text-black transition-colors"
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
        {isExpanded ? "Hide config" : "Show config"}
      </button>

      {isExpanded && (
        <div className="space-y-4">
          <CopyBlock code={configJson} />

          <div className="flex gap-3">
            <Button onClick={onDownload} variant="secondary" className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download {downloadFilename}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
