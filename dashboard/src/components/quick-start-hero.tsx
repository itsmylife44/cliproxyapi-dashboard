"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { OAuthSection } from "@/components/providers/oauth-section";

interface QuickStartHeroProps {
  proxyUrl: string;
}

export function QuickStartHero({
  proxyUrl,
}: QuickStartHeroProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const { showToast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState(false);

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
    <section aria-labelledby="quick-start-title" className="space-y-4">
      <div>
        <h1 id="quick-start-title" className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          {t("pageTitle")}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("pageDescription")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-between">
        <OAuthSection
          ctaOnly
          showToast={showToast}
          currentUser={user}
          refreshProviders={async () => router.refresh()}
        />
        <button
          type="button"
          onClick={() => void copyEndpoint()}
          aria-label={`${copiedUrl ? t("copiedShort") : t("copyShort")}: ${proxyUrl}`}
          className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <span className="truncate">{proxyUrl}</span>
          <span aria-live="polite" className="shrink-0 text-[10px] text-[var(--text-muted)]">
            {copiedUrl ? t("copiedShort") : t("copyShort")}
          </span>
        </button>
      </div>
    </section>
  );
}
