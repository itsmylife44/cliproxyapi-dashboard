"use client";

import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";

interface DashboardUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  availableVersions: string[];
  releaseUrl: string | null;
  releaseNotes: string | null;
}

interface PasswordSettingsProps {
  cliProxyVersion: string | null;
  cliProxyLoading: boolean;
  dashboardUpdateInfo: DashboardUpdateInfo | null;
  revokingSessions: boolean;
  onConfirmRevokeSessions: () => void;
}

export function PasswordSettings({
  cliProxyVersion,
  cliProxyLoading,
  dashboardUpdateInfo,
  revokingSessions,
  onConfirmRevokeSessions,
}: PasswordSettingsProps) {
  const t = useTranslations('settings.password');
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('sectionTitle')}</h2>
        <p className="text-xs text-[var(--text-muted)]">{t('sectionDescription')}</p>
      </div>

      <div className="space-y-3 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('sessionControlTitle')}</h3>
        <p className="text-sm text-[var(--text-muted)]">{t('sessionControlDescription')}</p>
        <Button variant="danger" onClick={onConfirmRevokeSessions} disabled={revokingSessions}>
          {revokingSessions ? t('buttonRevoking') : t('buttonForceLogout')}
        </Button>
      </div>

      <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('systemInfoTitle')}</h3>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
            <div className="font-medium text-[var(--text-muted)]">{t('environmentLabel')}</div>
            <div className="mt-1 text-[var(--text-primary)]">{process.env.NODE_ENV || t('environmentFallback')}</div>
          </div>
          <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
            <div className="font-medium text-[var(--text-muted)]">{t('nextjsLabel')}</div>
            <div className="mt-1 text-[var(--text-primary)]">16.1.6</div>
          </div>
          <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
            <div className="font-medium text-[var(--text-muted)]">{t('reactLabel')}</div>
            <div className="mt-1 text-[var(--text-primary)]">19.2.3</div>
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--surface-border)] pt-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-muted)]">{t('versionDetailsTitle')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>{t('dashboardVersionLabel')}</span>
              <span className="font-mono">{dashboardUpdateInfo?.currentVersion || t('dashboardVersionFallback')}</span>
            </div>
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>{t('cliProxyApiLabel')}</span>
              <span className="font-mono">
                {cliProxyLoading ? t('cliProxyLoading') : cliProxyVersion || t('cliProxyUnknown')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
