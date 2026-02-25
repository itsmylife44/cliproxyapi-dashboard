"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomProviderModal } from "@/components/custom-provider-modal";
import { useToast } from "@/components/ui/toast";
import { ProviderGroupModal } from "@/components/providers/provider-group-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

  // Confirm dialog state for group deletion
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{ isOpen: boolean; groupId: string | null }>({
    isOpen: false,
    groupId: null,
  });

  const loadProviderData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/provider-groups");
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
      
      // Calculate total count
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

  // --- Provider Handlers ---
  
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
        showToast(data.error || "Failed to delete custom provider", "error");
        return;
      }
      showToast("Custom provider deleted", "success");
      void loadProviderData();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleCustomProviderSuccess = () => {
    void loadProviderData();
  };

  const handleCustomProviderModalClose = () => {
    setShowCustomProviderModal(false);
    setEditingCustomProvider(undefined);
  };

  // --- Group Handlers ---
  
  const handleGroupEdit = (group: ProviderGroup) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  };
  
  const handleGroupModalClose = () => {
    setShowGroupModal(false);
    setEditingGroup(undefined);
  };
  
  const handleGroupSuccess = () => {
    void loadProviderData();
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
        showToast(data.error || "Failed to update group", "error");
        return;
      }
      
      void loadProviderData();
    } catch {
      showToast("Network error", "error");
    }
  };
  
  const confirmDeleteGroup = (groupId: string) => {
    setDeleteGroupDialog({ isOpen: true, groupId });
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
        showToast(data.error || "Failed to delete group", "error");
        return;
      }
      
      showToast("Group deleted", "success");
      setDeleteGroupDialog({ isOpen: false, groupId: null });
      void loadProviderData();
    } catch {
      showToast("Network error", "error");
    }
  };

  // --- Reordering Handlers ---
  
  const handleMoveGroupUp = async (groupId: string, index: number) => {
    if (index === 0) return;
    const newGroups = [...groups];
    [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
    
    setGroups(newGroups); // Optimistic UI update
    
    try {
      const groupIds = newGroups.map(g => g.id);
      const res = await fetch("/api/provider-groups/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
      });
      
      if (!res.ok) {
        showToast("Failed to reorder groups", "error");
        void loadProviderData(); // Revert
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData(); // Revert
    }
  };
  
  const handleMoveGroupDown = async (groupId: string, index: number) => {
    if (index === groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    
    setGroups(newGroups); // Optimistic UI update
    
    try {
      const groupIds = newGroups.map(g => g.id);
      const res = await fetch("/api/provider-groups/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
      });
      
      if (!res.ok) {
        showToast("Failed to reorder groups", "error");
        void loadProviderData(); // Revert
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData(); // Revert
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
  
  const handleMoveProviderUp = async (providerId: string, groupId: string | null, index: number) => {
    if (index === 0) return;
    
    // Apply optimistic update
    let newGroups = [...groups];
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
    
    // Send full array to server
    const allProviderIds: string[] = [];
    newGroups.forEach(g => {
      g.providers.forEach(p => allProviderIds.push(p.id));
    });
    newUngrouped.forEach(p => allProviderIds.push(p.id));
    
    try {
      const res = await fetch("/api/custom-providers/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerIds: allProviderIds }),
      });
      
      if (!res.ok) {
        showToast("Failed to reorder providers", "error");
        void loadProviderData(); // Revert
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData(); // Revert
    }
  };
  
  const handleMoveProviderDown = async (providerId: string, groupId: string | null, index: number) => {
    // Determine max index
    const listLength = groupId 
      ? groups.find(g => g.id === groupId)?.providers.length || 0
      : ungroupedProviders.length;
      
    if (index === listLength - 1) return;
    
    // Apply optimistic update
    let newGroups = [...groups];
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
    
    // Send full array to server
    const allProviderIds: string[] = [];
    newGroups.forEach(g => {
      g.providers.forEach(p => allProviderIds.push(p.id));
    });
    newUngrouped.forEach(p => allProviderIds.push(p.id));
    
    try {
      const res = await fetch("/api/custom-providers/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerIds: allProviderIds }),
      });
      
      if (!res.ok) {
        showToast("Failed to reorder providers", "error");
        void loadProviderData(); // Revert
      }
    } catch {
      showToast("Network error", "error");
      void loadProviderData(); // Revert
    }
  };

  // Helper component for Provider Row
  const ProviderRow = ({ provider, isFirst, isLast, index }: { provider: CustomProvider, isFirst: boolean, isLast: boolean, index: number }) => (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] items-center border-b border-slate-700/60 px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-100">{provider.name}</p>
        <p className="truncate text-xs text-slate-500">{provider.providerId}</p>
      </div>
      <p className="truncate text-xs text-slate-300 pr-2">{provider.baseUrl}</p>
      <p className="text-xs text-slate-300">{provider.models.length}</p>
      
      <div className="flex items-center gap-1">
        <button 
          onClick={() => handleMoveProviderUp(provider.id, provider.groupId, index)}
          disabled={isFirst}
          className="flex size-6 items-center justify-center rounded-sm border border-slate-700/70 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 transition-colors"
          title="Move Up"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </button>
        <button 
          onClick={() => handleMoveProviderDown(provider.id, provider.groupId, index)}
          disabled={isLast}
          className="flex size-6 items-center justify-center rounded-sm border border-slate-700/70 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 transition-colors"
          title="Move Down"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>
      
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          onClick={() => handleCustomProviderEdit(provider)}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          className="px-2.5 py-1 text-xs"
          onClick={() => handleCustomProviderDelete(provider.id)}
        >
          Delete
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <section id="provider-custom" className="space-y-3">
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

        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-3">
          {loading ? (
            <div className="rounded-md border border-slate-700/70 bg-slate-900/30 p-8">
              <div className="flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
                  <p className="text-sm text-white/70">Loading custom providers...</p>
                </div>
              </div>
            </div>
          ) : groups.length === 0 && ungroupedProviders.length === 0 ? (
            <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-8">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* Groups */}
              {groups.map((group, groupIndex) => {
                const isCollapsed = collapsedGroups.has(group.id);
                return (
                  <div 
                    key={group.id} 
                    className={`rounded-sm border border-slate-700/70 bg-slate-900/30 overflow-hidden transition-opacity duration-200 ${!group.isActive ? 'opacity-60 grayscale-[30%]' : ''}`}
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
                      <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => toggleCollapse(group.id)}>
                        {group.color && (
                          <span 
                            style={{ backgroundColor: group.color }} 
                            className="inline-block w-2.5 h-2.5 rounded-full" 
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                          {group.name}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded-md">
                          {group.providers.length}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Status Toggle */}
                        <button 
                          onClick={() => handleToggleGroupActive(group.id, group.isActive)}
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm transition-colors ${group.isActive ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                        >
                          {group.isActive ? "Active" : "Disabled"}
                        </button>
                        
                        {/* Group Reorder */}
                        <div className="flex items-center gap-0.5">
                          <button 
                            onClick={() => handleMoveGroupUp(group.id, groupIndex)}
                            disabled={groupIndex === 0}
                            className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
                            title="Move Group Up"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                          </button>
                          <button 
                            onClick={() => handleMoveGroupDown(group.id, groupIndex)}
                            disabled={groupIndex === groups.length - 1}
                            className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
                            title="Move Group Down"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1 border-l border-slate-700/70 pl-3">
                          <Button variant="ghost" onClick={() => handleGroupEdit(group)} className="px-2 py-1 text-[10px] h-auto">
                            Edit
                          </Button>
                          <Button variant="ghost" onClick={() => confirmDeleteGroup(group.id)} className="px-2 py-1 text-[10px] h-auto text-red-400 hover:text-red-300 hover:bg-red-400/10">
                            Delete
                          </Button>
                          <button 
                            onClick={() => toggleCollapse(group.id)}
                            className="p-1 ml-1 text-slate-400 hover:text-white transition-transform"
                            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Group Providers */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                          {group.providers.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs text-slate-500 italic">
                              No providers in this group
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] border-b border-slate-800 bg-slate-900/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                <span>Name</span>
                                <span>Endpoint</span>
                                <span>Models</span>
                                <span>Order</span>
                                <span className="text-right">Actions</span>
                              </div>
                              {group.providers.map((provider, idx) => (
                                <ProviderRow 
                                  key={provider.id} 
                                  provider={provider} 
                                  index={idx}
                                  isFirst={idx === 0}
                                  isLast={idx === group.providers.length - 1}
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
              
              {/* Ungrouped Providers */}
              {ungroupedProviders.length > 0 && (
                <div className="rounded-sm border border-slate-700/70 bg-slate-900/30 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-700/70 bg-slate-900/60 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Ungrouped
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded-md">
                      {ungroupedProviders.length}
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_80px_80px_120px] border-b border-slate-800 bg-slate-900/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        <span>Name</span>
                        <span>Endpoint</span>
                        <span>Models</span>
                        <span>Order</span>
                        <span className="text-right">Actions</span>
                      </div>
                      {ungroupedProviders.map((provider, idx) => (
                        <ProviderRow 
                          key={provider.id} 
                          provider={provider} 
                          index={idx}
                          isFirst={idx === 0}
                          isLast={idx === ungroupedProviders.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <CustomProviderModal
        isOpen={showCustomProviderModal}
        onClose={handleCustomProviderModalClose}
        provider={editingCustomProvider}
        onSuccess={handleCustomProviderSuccess}
      />
      
      <ProviderGroupModal
        isOpen={showGroupModal}
        onClose={handleGroupModalClose}
        group={editingGroup}
        onSuccess={handleGroupSuccess}
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
