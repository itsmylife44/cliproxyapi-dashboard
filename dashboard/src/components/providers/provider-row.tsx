"use client";

import { Button } from "@/components/ui/button";
import type { CustomProvider } from "@/components/providers/custom-provider-section";

interface ProviderRowProps {
  provider: CustomProvider;
  isFirst: boolean;
  isLast: boolean;
  index: number;
  onEdit: (provider: CustomProvider) => void;
  onDelete: (providerId: string) => void;
  onMoveUp: (providerId: string, groupId: string | null, index: number) => void;
  onMoveDown: (providerId: string, groupId: string | null, index: number) => void;
}

export function ProviderRow({
  provider,
  isFirst,
  isLast,
  index,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ProviderRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] items-center border-b border-[#e5e5e5] px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-black">{provider.name}</p>
          {!provider.hasEncryptedKey && (
            <span
              title="Re-save this provider to enable auto-resync after proxy restarts"
              className="shrink-0 rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
            >
              re-save
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[#777169]">{provider.providerId}</p>
      </div>
      <p className="truncate text-xs text-[#4e4e4e] pr-2">{provider.baseUrl}</p>
      <p className="text-xs text-[#4e4e4e]">{provider.models.length}</p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMoveUp(provider.id, provider.groupId, index)}
          disabled={isFirst}
          className="flex size-6 items-center justify-center rounded-sm border border-[#e5e5e5] bg-[#f5f5f5] text-[#4e4e4e] hover:bg-[#e5e5e5] hover:text-black disabled:opacity-30 disabled:hover:bg-[#f5f5f5] disabled:hover:text-[#4e4e4e] transition-colors"
          title="Move Up"
          aria-label={`Move ${provider.name} up`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(provider.id, provider.groupId, index)}
          disabled={isLast}
          className="flex size-6 items-center justify-center rounded-sm border border-[#e5e5e5] bg-[#f5f5f5] text-[#4e4e4e] hover:bg-[#e5e5e5] hover:text-black disabled:opacity-30 disabled:hover:bg-[#f5f5f5] disabled:hover:text-[#4e4e4e] transition-colors"
          title="Move Down"
          aria-label={`Move ${provider.name} down`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          onClick={() => onEdit(provider)}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          className="px-2.5 py-1 text-xs"
          onClick={() => onDelete(provider.id)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
