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
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] items-center border-b border-[var(--surface-border)] px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{provider.name}</p>
          {!provider.hasEncryptedKey && (
            <span
              title="Re-save this provider to enable auto-resync after proxy restarts"
              className="shrink-0 rounded-sm border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
            >
              re-save
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--text-muted)]">{provider.providerId}</p>
      </div>
      <p className="truncate text-xs text-[var(--text-secondary)] pr-2">{provider.baseUrl}</p>
      <p className="text-xs text-[var(--text-secondary)]">{provider.models.length}</p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMoveUp(provider.id, provider.groupId, index)}
          disabled={isFirst}
          className="flex size-6 items-center justify-center rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-[var(--surface-muted)] disabled:hover:text-[var(--text-secondary)] transition-colors"
          title="Move Up"
          aria-label={`Move ${provider.name} up`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(provider.id, provider.groupId, index)}
          disabled={isLast}
          className="flex size-6 items-center justify-center rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-[var(--surface-muted)] disabled:hover:text-[var(--text-secondary)] transition-colors"
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
