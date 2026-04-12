"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

interface CopyBlockProps {
  code: string;
}

export function CopyBlock({ code }: CopyBlockProps) {
  const t = useTranslations("copyBlock");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group overflow-hidden">
      <pre className="bg-[var(--surface-muted)] border border-[var(--surface-border)] rounded-lg p-3 pr-14 font-mono text-xs sm:text-sm text-[var(--text-primary)] overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <span className="sr-only" aria-live="polite">
        {copied ? t("copiedToClipboard") : ""}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
        className="absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg border transition-[color,background-color,border-color,transform] duration-200 bg-[var(--surface-base)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:scale-95"
      >
        {copied ? (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {tCommon("copied")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {tCommon("copy")}
          </span>
        )}
      </button>
    </div>
  );
}
