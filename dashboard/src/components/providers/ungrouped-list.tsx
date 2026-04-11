"use client";

import { ProviderRow } from "@/components/providers/provider-row";
import type { CustomProvider } from "@/components/providers/custom-provider-section";

interface UngroupedListProps {
  providers: CustomProvider[];
  onEditProvider: (provider: CustomProvider) => void;
  onDeleteProvider: (providerId: string) => void;
  onMoveProviderUp: (providerId: string, groupId: string | null, index: number) => void;
  onMoveProviderDown: (providerId: string, groupId: string | null, index: number) => void;
}

export function UngroupedList({
  providers,
  onEditProvider,
  onDeleteProvider,
  onMoveProviderUp,
  onMoveProviderDown,
}: UngroupedListProps) {
  if (providers.length === 0) return null;

  return (
    <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--surface-border)] bg-[var(--surface-base)]/60 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Ungrouped
        </span>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded-md">
          {providers.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <span>Name</span>
            <span>Endpoint</span>
            <span>Models</span>
            <span>Order</span>
            <span className="text-right">Actions</span>
          </div>
          {providers.map((provider, idx) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === providers.length - 1}
              onEdit={onEditProvider}
              onDelete={onDeleteProvider}
              onMoveUp={onMoveProviderUp}
              onMoveDown={onMoveProviderDown}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
