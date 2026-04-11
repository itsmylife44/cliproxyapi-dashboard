"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CreatedKey {
  id: string;
  key: string;
  name: string;
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

interface RevealBoxProps {
  createdKey: CreatedKey;
}

export function RevealBox({ createdKey }: RevealBoxProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail (e.g. permissions denied, non-secure context)
    }
  }, [createdKey.key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Copy your API key now -- it will not be shown again after you leave this
        page.
      </div>
      <div className="flex items-center gap-2 rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]/60 px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs text-[var(--text-primary)]">
          {createdKey.key}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex flex-shrink-0 items-center gap-1 rounded border border-[var(--surface-border)]/60 bg-[var(--surface-muted)]/70 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]/80 hover:text-[var(--text-primary)]"
        >
          <CopyIcon />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
