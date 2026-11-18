"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OAuthProviderId } from "@/components/providers/oauth-section";

interface OAuthProviderEntry {
  id: OAuthProviderId;
  name: string;
}

interface OAuthActionsProps {
  providers: readonly OAuthProviderEntry[];
  mode?: "connect" | "import" | "both";
  onConnect: (providerId: OAuthProviderId) => void;
  onImport: (providerId: OAuthProviderId) => void;
}

export function OAuthActions({
  providers,
  mode = "both",
  onConnect,
  onImport,
}: OAuthActionsProps) {
  const t = useTranslations("providers");

  return (
    <div className="divide-y divide-[var(--surface-border)] border-t border-b border-[var(--surface-border)]">
      {providers.map((provider, index) => (
        <div
          key={provider.id}
          className={cn(
            "flex items-center justify-between gap-3 py-2.5",
            index === 0 && "pt-2.5"
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="text-sm font-medium text-[var(--text-primary)]">{provider.name}</div>
            <p className="text-xs text-[var(--text-muted)]">{t(`oauthProviderDescriptions.${provider.id}`)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {(mode === "connect" || mode === "both") && (
              <Button
                variant={mode === "connect" ? "primary" : "secondary"}
                onClick={() => onConnect(provider.id)}
                className="shrink-0 px-2.5 py-1 text-xs"
              >
                {t("connectButton")}
              </Button>
            )}
            {(mode === "import" || mode === "both") && (
              <Button
                variant={mode === "import" ? "primary" : "secondary"}
                onClick={() => onImport(provider.id)}
                className="shrink-0 px-2.5 py-1 text-xs"
              >
                {t("importJsonButton")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
