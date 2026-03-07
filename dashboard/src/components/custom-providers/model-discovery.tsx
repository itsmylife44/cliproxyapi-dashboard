"use client";

import { Button } from "@/components/ui/button";

interface FetchedModel {
  id: string;
  selected: boolean;
}

interface ModelDiscoveryProps {
  baseUrl: string;
  apiKey: string;
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
  baseUrl,
  apiKey,
  fetchingModels,
  saving,
  fetchedModels,
  showFetchedModels,
  onFetchModels,
  onToggleFetchedModel,
  onToggleAllFetchedModels,
  onAddSelectedModels,
}: ModelDiscoveryProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Auto-Discover Models</span>
        <Button
          variant="secondary"
          onClick={onFetchModels}
          disabled={!baseUrl.startsWith("https://") || apiKey.length === 0 || fetchingModels || saving}
          className="px-3 py-1.5 text-xs"
        >
          {fetchingModels ? (
            <span className="flex items-center gap-2">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Fetching...
            </span>
          ) : "Fetch Models"}
        </Button>
      </div>
      {showFetchedModels && fetchedModels.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Available Models ({fetchedModels.length})</span>
              <span className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded">
                {fetchedModels.filter(m => m.selected).length} selected
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleAllFetchedModels}
              className="text-xs text-white/70 hover:text-white transition-colors"
            >
              {fetchedModels.every(m => m.selected) ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 mb-3">
            {fetchedModels.map((model) => (
              <label key={model.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-2 py-1.5 transition-colors">
                <input
                  type="checkbox"
                  checked={model.selected}
                  onChange={() => onToggleFetchedModel(model.id)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-500 focus:ring-2 focus:ring-blue-500/50"
                />
                <span className="text-sm text-white/70">{model.id}</span>
              </label>
            ))}
          </div>
          <Button
            onClick={onAddSelectedModels}
            disabled={fetchedModels.filter(m => m.selected).length === 0}
            className="w-full"
          >
            Add Selected ({fetchedModels.filter(m => m.selected).length})
          </Button>
        </div>
      )}
      <p className="text-xs text-white/50 mb-2">Or manually add model mappings below</p>
    </div>
  );
}
