"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomProviderModal } from "@/components/custom-provider-modal";
import { useToast } from "@/components/ui/toast";
import { ProviderGroupModal } from "@/components/providers/provider-group-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GroupList } from "@/components/providers/group-list";
import { UngroupedList } from "@/components/providers/ungrouped-list";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface CustomProviderSectionProps {
  showToast: ShowToast;
  onProviderCountChange: (count: number) => void;
}

interface ModelMapping {
  upstreamName: string;
  alias: string;
}

export interface CustomProvider {
  id: string;
  name: string;
  providerId: string;
  baseUrl: string;
  prefix: string | null;
  proxyUrl: string | null;
  headers: Record<string, string>;
  models: ModelMapping[];
  excludedModels: { pattern: string }[];
  groupId: string | null;
  sortOrder: number;
  hasEncryptedKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderGroup {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  providers: CustomProvider[];
}

export function CustomProviderSection({ showToast, onProviderCountChange }: CustomProviderSectionProps) {
  const [groups, setGroups] = useState<ProviderGroup[]>([]);
  const [ungroupedProviders, setUngroupedProviders] = useState<CustomProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCustomProviderModal, setShowCustomProviderModal] = useState(false);
  const [editingCustomProvider, setEditingCustomProvider] = useState<CustomProvider | undefined>(undefined);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProviderGroup | undefined>(undefined);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{ isOpen: boolean; groupId: string | null }>({
    isOpen: false,
    groupId: null,
  });

  const loadProviderData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.PROVIDER_GROUPS.BASE);
      if (!res.ok) {
        showToast("Failed to load custom providers", "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const groupsData = Array.isArray(data.groups) ? data.groups : [];
      const ungroupedData = Array.isArray(data.ungrouped) ? data.ungrouped : [];

      setGroups(groupsData);
      setUngroupedProviders(ungroupedData);

      let totalCount = ungroupedData.length;
      groupsData.forEach((g: ProviderGroup) => {
        totalCount += g.providers.length;
      });

      onProviderCountChange(totalCount);
      setLoading(false);
    } catch {
      setLoading(false);
      showToast("Network error", "error");
    }
  }, [onProviderCountChange, showToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProviderData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadProviderData]);

  const handleCustomProviderEdit = (provider: CustomProvider) => {
    setEditingCustomProvider(provider);
    setShowCustomProviderModal(true);
  };

  const handleCustomProviderDelete = async (providerId: string) => {
    try {
      const res = await fetch(`/api/custom-providers/${providerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, "Failed to delete custom provider"), "error");
        return;
      }
      showToast("Custom provider deleted", "success");
      void loadProviderData();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleCustomProviderModalClose = () => {
    setShowCustomProviderModal(false);
    setEditingCustomProvider(undefined);
  };

  const handleGroupEdit = (group: ProviderGroup) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  };

  const handleGroupModalClose = () => {
    setShowGroupModal(false);
    setEditingGroup(undefined);
  };

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleToggleGroupActive = async (groupId: string, currentIsActive: boolean) => {
    try {
      const res = await fetch(`/api/provider-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentIsActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, "Failed to update group"), "error");
        return;
      }

      void loadProviderData();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleDeleteGroup = async () => {
    const { groupId } = deleteGroupDialog;
    if (!groupId) return;

    try {
      const res = await fetch(`/api/provider-groups/${groupId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, "Failed to delete group"), "error");
        return;
      }

      showToast("Group deleted", "success");
      setDeleteGroupDialog({ isOpen: false, groupId: null });
      void loadProviderData();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleMoveGroupUp = async (groupId: string, index: number) => {
    if (index === 0) return;
    const newGroups = [...groups];
    [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];

    setGroups(newGroups);

    try {
      const groupIds = newGroups.map(g => g.id);
      const res = await fetch(API_ENDPOINTS.PROVIDER_GROUPS.REORDER, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
      });

      if (!res.ok) {
        showToast("Failed to reorder groups", "error");
        void loadProviderData();
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData();
    }
  };

  const handleMoveGroupDown = async (groupId: string, index: number) => {
    if (index === groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];

    setGroups(newGroups);

    try {
      const groupIds = newGroups.map(g => g.id);
      const res = await fetch(API_ENDPOINTS.PROVIDER_GROUPS.REORDER, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
      });

      if (!res.ok) {
        showToast("Failed to reorder groups", "error");
        void loadProviderData();
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData();
    }
  };

  const moveProviderInList = (list: CustomProvider[], index: number, direction: 'up' | 'down') => {
    const newList = [...list];
    if (direction === 'up' && index > 0) {
      [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    } else if (direction === 'down' && index < newList.length - 1) {
      [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    }
    return newList;
  };

  const reorderProviders = async (newGroups: ProviderGroup[], newUngrouped: CustomProvider[]) => {
    const allProviderIds: string[] = [];
    newGroups.forEach(g => {
      g.providers.forEach(p => allProviderIds.push(p.id));
    });
    newUngrouped.forEach(p => allProviderIds.push(p.id));

    try {
      const res = await fetch(API_ENDPOINTS.CUSTOM_PROVIDERS.REORDER, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerIds: allProviderIds }),
      });

      if (!res.ok) {
        showToast("Failed to reorder providers", "error");
        void loadProviderData();
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData();
    }
  };

  const handleMoveProviderUp = async (providerId: string, groupId: string | null, index: number) => {
    if (index === 0) return;

    const newGroups = [...groups];
    let newUngrouped = [...ungroupedProviders];

    if (groupId) {
      const groupIndex = newGroups.findIndex(g => g.id === groupId);
      if (groupIndex !== -1) {
        newGroups[groupIndex] = {
          ...newGroups[groupIndex],
          providers: moveProviderInList(newGroups[groupIndex].providers, index, 'up')
        };
        setGroups(newGroups);
      }
    } else {
      newUngrouped = moveProviderInList(newUngrouped, index, 'up');
      setUngroupedProviders(newUngrouped);
    }

    await reorderProviders(newGroups, newUngrouped);
  };

  const handleMoveProviderDown = async (providerId: string, groupId: string | null, index: number) => {
    const listLength = groupId
      ? groups.find(g => g.id === groupId)?.providers.length || 0
      : ungroupedProviders.length;

    if (index === listLength - 1) return;

    const newGroups = [...groups];
    let newUngrouped = [...ungroupedProviders];

    if (groupId) {
      const groupIndex = newGroups.findIndex(g => g.id === groupId);
      if (groupIndex !== -1) {
        newGroups[groupIndex] = {
          ...newGroups[groupIndex],
          providers: moveProviderInList(newGroups[groupIndex].providers, index, 'down')
        };
        setGroups(newGroups);
      }
    } else {
      newUngrouped = moveProviderInList(newUngrouped, index, 'down');
      setUngroupedProviders(newUngrouped);
    }

    await reorderProviders(newGroups, newUngrouped);
  };

  return (
    <>
      <div id="provider-custom" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Custom Providers</h2>
            <p className="text-xs text-slate-400">OpenAI-compatible endpoints and mappings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowGroupModal(true)} className="px-2.5 py-1 text-xs">
              Manage Groups
            </Button>
            <Button onClick={() => setShowCustomProviderModal(true)} className="px-2.5 py-1 text-xs">
              Add Custom Provider
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
              <p className="text-sm text-white/70">Loading custom providers...</p>
            </div>
          </div>
        ) : groups.length === 0 && ungroupedProviders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-100">No custom providers configured</h3>
              <p className="text-xs text-slate-400">Add an OpenAI-compatible provider to extend your AI capabilities</p>
            </div>
            <Button onClick={() => setShowCustomProviderModal(true)} className="px-3 py-1.5 text-xs">
              Add Custom Provider
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <GroupList
              groups={groups}
              collapsedGroups={collapsedGroups}
              onToggleCollapse={toggleCollapse}
              onToggleGroupActive={handleToggleGroupActive}
              onEditGroup={handleGroupEdit}
              onDeleteGroup={(groupId) => setDeleteGroupDialog({ isOpen: true, groupId })}
              onMoveGroupUp={handleMoveGroupUp}
              onMoveGroupDown={handleMoveGroupDown}
              onEditProvider={handleCustomProviderEdit}
              onDeleteProvider={handleCustomProviderDelete}
              onMoveProviderUp={handleMoveProviderUp}
              onMoveProviderDown={handleMoveProviderDown}
            />

            <UngroupedList
              providers={ungroupedProviders}
              onEditProvider={handleCustomProviderEdit}
              onDeleteProvider={handleCustomProviderDelete}
              onMoveProviderUp={handleMoveProviderUp}
              onMoveProviderDown={handleMoveProviderDown}
            />
          </div>
        )}
      </div>

      <CustomProviderModal
        isOpen={showCustomProviderModal}
        onClose={handleCustomProviderModalClose}
        provider={editingCustomProvider}
        onSuccess={() => void loadProviderData()}
      />

      <ProviderGroupModal
        isOpen={showGroupModal}
        onClose={handleGroupModalClose}
        group={editingGroup}
        onSuccess={() => void loadProviderData()}
      />

      <ConfirmDialog
        isOpen={deleteGroupDialog.isOpen}
        onClose={() => setDeleteGroupDialog({ isOpen: false, groupId: null })}
        onConfirm={handleDeleteGroup}
        title="Delete Provider Group"
        message="Are you sure you want to delete this group? The providers inside will not be deleted, they will just become ungrouped. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
