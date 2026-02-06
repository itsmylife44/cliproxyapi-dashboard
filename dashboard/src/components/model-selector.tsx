"use client";

import { useState, useEffect, useRef } from "react";

interface ModelSelectorProps {
  availableModels: string[];
  initialExcludedModels: string[];
  onSelectionChange: (excludedModels: string[]) => void;
}

const SAVE_STATUS = {
  IDLE: "idle",
  SAVING: "saving",
  SAVED: "saved",
} as const;

type SaveStatus = (typeof SAVE_STATUS)[keyof typeof SAVE_STATUS];

export function ModelSelector({
  availableModels,
  initialExcludedModels,
  onSelectionChange,
}: ModelSelectorProps) {
  const [excludedModels, setExcludedModels] = useState<Set<string>>(
    () => new Set(initialExcludedModels)
  );
  const [isOpen, setIsOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SAVE_STATUS.IDLE);
  const isFirstRender = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedModels = [...availableModels].sort((a, b) =>
    a.localeCompare(b)
  );

  const selectedCount = availableModels.length - excludedModels.size;

  const handleToggle = (modelId: string) => {
    setExcludedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      onSelectionChange(Array.from(next));
      return next;
    });
  };

  const handleSelectAll = () => {
    setExcludedModels(new Set());
    onSelectionChange([]);
  };

  const handleDeselectAll = () => {
    const allModels = new Set(availableModels);
    setExcludedModels(allModels);
    onSelectionChange(availableModels);
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }

    setSaveStatus(SAVE_STATUS.SAVING);
    saveTimeoutRef.current = setTimeout(() => {
      const saveData = async () => {
        try {
          const response = await fetch("/api/model-preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              excludedModels: Array.from(excludedModels),
            }),
          });

          if (response.ok) {
            setSaveStatus(SAVE_STATUS.SAVED);
            savedTimeoutRef.current = setTimeout(() => {
              setSaveStatus(SAVE_STATUS.IDLE);
            }, 2000);
          } else {
            setSaveStatus(SAVE_STATUS.IDLE);
          }
        } catch {
          setSaveStatus(SAVE_STATUS.IDLE);
        }
      };

      void saveData();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, [excludedModels]);

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl"
      data-testid="model-selector"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
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
            <span className="text-sm font-semibold text-white">
              Model Selection
            </span>
          </button>

          <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/50">
            {selectedCount} of {availableModels.length} selected
          </span>
        </div>

        {saveStatus === SAVE_STATUS.SAVING && (
          <span className="text-xs text-white/50">Saving...</span>
        )}
        {saveStatus === SAVE_STATUS.SAVED && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Saved"
            >
              <title>Saved</title>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
            >
              Select All
            </button>
            <span className="text-white/30">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
            >
              Deselect All
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {sortedModels.map((modelId) => {
              const isChecked = !excludedModels.has(modelId);
              return (
                <label
                  key={modelId}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(modelId)}
                    className="size-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-white/70 group-hover:text-white/90 transition-colors">
                    {modelId}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
