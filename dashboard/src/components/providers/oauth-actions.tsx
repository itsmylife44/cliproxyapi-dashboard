"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OAuthProviderId } from "@/components/providers/oauth-section";

interface OAuthProviderEntry {
  id: OAuthProviderId;
  name: string;
  description: string;
}

interface OAuthActionsProps {
  providers: readonly OAuthProviderEntry[];
  onConnect: (providerId: OAuthProviderId) => void;
  onImport: (providerId: OAuthProviderId) => void;
}

export function OAuthActions({
  providers,
  onConnect,
  onImport,
}: OAuthActionsProps) {
  const t = useTranslations("providers");

  return (
    <>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("connectNewAccount")}</h3>
      </div>
      <div className="overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-base)]">
        {providers.map((provider, index) => (
          <div
            key={provider.id}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2.5",
              index !== providers.length - 1 && "border-b border-[var(--surface-border)]"
            )}
          >
            <div className="space-y-1">
              <div className="text-sm font-medium text-[var(--text-primary)]">{provider.name}</div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">{provider.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="secondary"
                onClick={() => onConnect(provider.id)}
                className="shrink-0 px-2.5 py-1 text-xs"
              >
                {t("connectButton")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onImport(provider.id)}
                className="shrink-0 px-2.5 py-1 text-xs"
              >
                {t("importJsonButton")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
