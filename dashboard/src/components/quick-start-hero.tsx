"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { OAuthSection } from "@/components/providers/oauth-section";

interface QuickStartHeroProps {
  isHealthy: boolean;
  providerCount: number;
  apiKeyCount: number;
  modelCount: number;
  proxyUrl: string;
}

export function QuickStartHero({
  isHealthy,
  providerCount,
  apiKeyCount,
  modelCount,
  proxyUrl,
}: QuickStartHeroProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const { showToast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentUser = user
    ? { id: user.id, username: user.username, isAdmin: user.isAdmin }
    : null;

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(proxyUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      showToast(t("endpointCopyFailed"), "error");
    }
  };

  return (
    <section
      aria-label={t("heroConnectLabel")}
      className="flex flex-col gap-3 border-b border-[var(--surface-border)] pb-5"
    >
      <div>
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          {t("pageTitle")}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {t("pageDescription")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <OAuthSection
          ctaOnly
          ctaLabel={t("addAccountHeroCta")}
          showToast={showToast}
          currentUser={currentUser}
          refreshProviders={async () => {
            router.refresh();
          }}
          onAccountCountChange={() => {}}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
            <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-rose-500"}`} />
            {isHealthy ? t("statusOnline") : t("statusOffline")}
          </span>
          <span>{t("statusProvidersValue", { count: providerCount })}</span>
          <span>{t("statusApiKeysValue", { count: apiKeyCount })}</span>
          <span>{t("heroModelsValue", { count: modelCount })}</span>
          <button
            type="button"
            onClick={() => void copyEndpoint()}
            title={proxyUrl}
            className="inline-flex max-w-[280px] items-center gap-1.5 truncate font-mono text-[11px] text-[var(--text-secondary)] underline decoration-[var(--surface-border)] underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
          >
            <span className="truncate">{proxyUrl}</span>
            <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
              {copiedUrl ? t("copiedShort") : t("copyShort")}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
