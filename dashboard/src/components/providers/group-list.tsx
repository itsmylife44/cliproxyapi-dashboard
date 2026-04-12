"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ProviderRow } from "@/components/providers/provider-row";
import type { CustomProvider, ProviderGroup } from "@/components/providers/custom-provider-section";

interface GroupListProps {
  groups: ProviderGroup[];
  collapsedGroups: Set<string>;
  onToggleCollapse: (groupId: string) => void;
  onToggleGroupActive: (groupId: string, currentIsActive: boolean) => void;
  onEditGroup: (group: ProviderGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroupUp: (groupId: string, index: number) => void;
  onMoveGroupDown: (groupId: string, index: number) => void;
  onEditProvider: (provider: CustomProvider) => void;
  onDeleteProvider: (providerId: string) => void;
  onMoveProviderUp: (providerId: string, groupId: string | null, index: number) => void;
  onMoveProviderDown: (providerId: string, groupId: string | null, index: number) => void;
}

export function GroupList({
  groups,
  collapsedGroups,
  onToggleCollapse,
  onToggleGroupActive,
  onEditGroup,
  onDeleteGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onEditProvider,
  onDeleteProvider,
  onMoveProviderUp,
  onMoveProviderDown,
}: GroupListProps) {
  const t = useTranslations("providers");

  return (
    <>
      {groups.map((group, groupIndex) => {
        const isCollapsed = collapsedGroups.has(group.id);
        return (
          <div
            key={group.id}
            className={`rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] overflow-hidden transition-opacity duration-200 ${!group.isActive ? 'opacity-60 grayscale-[30%]' : ''}`}
          >
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-base)]/60 px-3 py-2">
              <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onToggleCollapse(group.id)}>
                {group.color && (
                  <span
                    style={{ backgroundColor: group.color }}
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    aria-hidden="true"
                  />
                )}
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  {group.name}
                </span>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded-md">
                  {group.providers.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleGroupActive(group.id, group.isActive)}
                  className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm transition-colors ${group.isActive ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15' : 'bg-[var(--surface-border)] text-[var(--text-muted)] hover:bg-[var(--surface-border)]'}`}
                >
                  {group.isActive ? t("statusActive") : t("groupStatusDisabled")}
                </button>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onMoveGroupUp(group.id, groupIndex)}
                    disabled={groupIndex === 0}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 p-1"
                    title={t("moveGroupUp")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveGroupDown(group.id, groupIndex)}
                    disabled={groupIndex === groups.length - 1}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 p-1"
                    title={t("moveGroupDown")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>

                  <div className="flex items-center gap-1 border-l border-[var(--surface-border)] pl-3">
                  <Button variant="ghost" onClick={() => onEditGroup(group)} className="px-2 py-1 text-[10px] h-auto">
                    {t("editButton")}
                  </Button>
                  <Button variant="ghost" onClick={() => onDeleteGroup(group.id)} className="px-2 py-1 text-[10px] h-auto text-red-600 hover:text-red-600 hover:bg-red-400/10">
                    {t("deleteButton")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => onToggleCollapse(group.id)}
                    className="p-1 ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-transform"
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {group.providers.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)] italic">
                      {t("noProvidersInGroup")}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] border-b border-[var(--surface-border)] bg-[var(--surface-base)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        <span>{t("tableHeaderName")}</span>
                        <span>{t("tableHeaderEndpoint")}</span>
                        <span>{t("tableHeaderModels")}</span>
                        <span>{t("tableHeaderOrder")}</span>
                        <span className="text-right">{t("tableHeaderActions")}</span>
                      </div>
                      {group.providers.map((provider, idx) => (
                        <ProviderRow
                          key={provider.id}
                          provider={provider}
                          index={idx}
                          isFirst={idx === 0}
                          isLast={idx === group.providers.length - 1}
                          onEdit={onEditProvider}
                          onDelete={onDeleteProvider}
                          onMoveUp={onMoveProviderUp}
                          onMoveDown={onMoveProviderDown}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
