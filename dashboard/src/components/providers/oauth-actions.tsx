"use client";

import { useTranslations } from "next-intl";
import type { OAuthProviderId } from "@/components/providers/oauth-section";

interface OAuthProviderEntry {
  id: OAuthProviderId;
  name: string;
}

interface OAuthActionsProps {
  providers: readonly OAuthProviderEntry[];
  mode?: "connect" | "import";
  onConnect: (providerId: OAuthProviderId) => void;
  onImport: (providerId: OAuthProviderId) => void;
}

export function OAuthActions({
  providers,
  mode = "connect",
  onConnect,
  onImport,
}: OAuthActionsProps) {
  const t = useTranslations("providers");

  return (
    <div className="divide-y divide-[var(--surface-border)] border-t border-b border-[var(--surface-border)]">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => (mode === "import" ? onImport(provider.id) : onConnect(provider.id))}
          className="group flex w-full cursor-pointer items-center justify-between gap-3 px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
        >
          <div className="min-w-0 space-y-0.5">
            <div className="text-sm font-medium text-[var(--text-primary)]">{provider.name}</div>
            <p className="text-xs text-[var(--text-muted)]">{t(`oauthProviderDescriptions.${provider.id}`)}</p>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}
