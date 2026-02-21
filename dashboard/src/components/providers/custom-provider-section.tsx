"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomProviderModal } from "@/components/custom-provider-modal";
import { useToast } from "@/components/ui/toast";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface CustomProviderSectionProps {
  showToast: ShowToast;
  onProviderCountChange: (count: number) => void;
}

interface ModelMapping {
  upstreamName: string;
  alias: string;
}

interface CustomProvider {
  id: string;
  name: string;
  providerId: string;
  baseUrl: string;
  prefix: string | null;
  proxyUrl: string | null;
  headers: Record<string, string>;
  models: ModelMapping[];
  excludedModels: { pattern: string }[];
  createdAt: string;
  updatedAt: string;
}

export function CustomProviderSection({ showToast, onProviderCountChange }: CustomProviderSectionProps) {
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [customProvidersLoading, setCustomProvidersLoading] = useState(true);
  const [showCustomProviderModal, setShowCustomProviderModal] = useState(false);
  const [editingCustomProvider, setEditingCustomProvider] = useState<CustomProvider | undefined>(undefined);

  const loadCustomProviders = useCallback(async () => {
    setCustomProvidersLoading(true);
    try {
      const res = await fetch("/api/custom-providers");
      if (!res.ok) {
        showToast("Failed to load custom providers", "error");
        setCustomProvidersLoading(false);
        return;
      }

      const data = await res.json();
      const providers = Array.isArray(data.providers) ? data.providers : [];
      setCustomProviders(providers);
      onProviderCountChange(providers.length);
      setCustomProvidersLoading(false);
    } catch {
      setCustomProvidersLoading(false);
      showToast("Network error", "error");
    }
  }, [onProviderCountChange, showToast]);

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
      void loadCustomProviders();
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleCustomProviderSuccess = () => {
    void loadCustomProviders();
  };

  const handleCustomProviderModalClose = () => {
    setShowCustomProviderModal(false);
    setEditingCustomProvider(undefined);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCustomProviders();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadCustomProviders]);

  return (
    <>
      <section id="provider-custom" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Custom Providers</h2>
            <p className="text-xs text-slate-400">OpenAI-compatible endpoints and mappings</p>
          </div>
          <Button onClick={() => setShowCustomProviderModal(true)} className="px-2.5 py-1 text-xs">
            Add Custom Provider
          </Button>
        </div>

        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-3">

          {customProvidersLoading ? (
            <div className="rounded-md border border-slate-700/70 bg-slate-900/30 p-8">
              <div className="flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-blue-500"></div>
                  <p className="text-sm text-white/70">Loading custom providers...</p>
                </div>
              </div>
            </div>
          ) : customProviders.length === 0 ? (
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
            <div className="overflow-x-auto">
              <div className="min-w-[600px] overflow-hidden rounded-sm border border-slate-700/70 bg-slate-900/30">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_120px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <span>Name</span>
                  <span>Endpoint</span>
                  <span>Models</span>
                  <span>Actions</span>
                </div>
                {customProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_120px] items-center border-b border-slate-700/60 px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{provider.name}</p>
                      <p className="truncate text-xs text-slate-500">{provider.providerId}</p>
                    </div>
                    <p className="truncate text-xs text-slate-300">{provider.baseUrl}</p>
                    <p className="text-xs text-slate-300">{provider.models.length}</p>
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
                ))}
              </div>
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
    </>
  );
}
