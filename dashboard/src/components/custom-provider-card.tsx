"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
}

interface CustomProviderCardProps {
  provider: CustomProvider;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomProviderCard({ provider, onEdit, onDelete }: CustomProviderCardProps) {
  const [showFullUrl, setShowFullUrl] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const truncateUrl = (url: string) => {
    if (url.length <= 40) return url;
    return url.substring(0, 37) + "...";
  };

  return (
    <div className="group relative overflow-hidden backdrop-blur-2xl glass-card rounded-xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] hover:scale-[1.02]">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl"></div>

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{provider.name}</h3>
            <p className="text-xs font-mono text-white/50 truncate">{provider.providerId}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              className="px-3 py-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setShowConfirm(true)}
            >
              Delete
            </Button>
          </div>
        </div>

        <ConfirmDialog
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={onDelete}
          title="Delete Custom Provider"
          message={`Delete custom provider "${provider.name}"?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
        />

        <button 
          type="button"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors text-left"
          onClick={() => setShowFullUrl(!showFullUrl)}
          title={provider.baseUrl}
        >
          <p className="text-xs text-white/70 font-mono break-all">
            {showFullUrl ? provider.baseUrl : truncateUrl(provider.baseUrl)}
          </p>
        </button>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border border-blue-400/50 px-2.5 py-1 text-xs font-bold text-blue-300">
            <span className="size-1.5 rounded-full bg-blue-400"></span>
            {provider.models.length} {provider.models.length === 1 ? 'model' : 'models'}
          </span>

          {provider.prefix && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-xs font-medium text-white/70">
              <span className="size-1.5 rounded-full bg-purple-400"></span>
              {provider.prefix}
            </span>
          )}

          {provider.excludedModels.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-white/50">
              {provider.excludedModels.length} excluded
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
