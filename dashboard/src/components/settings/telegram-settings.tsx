"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface SyncToken {
  id: string;
  name: string;
  syncApiKeyId: string | null;
  syncApiKeyName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isRevoked: boolean;
}

interface AvailableApiKey {
  id: string;
  name: string;
}

interface TelegramSettingsProps {
  syncTokens: SyncToken[];
  syncTokensLoading: boolean;
  generatingToken: boolean;
  generatedToken: string | null;
  showInstructions: boolean;
  availableApiKeys: AvailableApiKey[];
  onGenerateToken: () => void;
  onClearGeneratedToken: () => void;
  onCopyToken: (token: string) => void;
  onToggleInstructions: () => void;
  onConfirmRevokeToken: (id: string) => void;
  onUpdateTokenApiKey: (tokenId: string, apiKeyId: string) => void;
}

export function TelegramSettings({
  syncTokens,
  syncTokensLoading,
  generatingToken,
  generatedToken,
  showInstructions,
  availableApiKeys,
  onGenerateToken,
  onClearGeneratedToken,
  onCopyToken,
  onToggleInstructions,
  onConfirmRevokeToken,
  onUpdateTokenApiKey,
}: TelegramSettingsProps) {
  const t = useTranslations("settings.telegram");
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('sectionTitle')}</h2>
        <p className="text-xs text-[var(--text-muted)]">{t('sectionDescription')}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('syncTokensTitle')}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">{t('syncTokensDescription')}</p>
            <Button onClick={onGenerateToken} disabled={generatingToken}>
              {generatingToken ? t("buttonGenerating") : t("buttonGenerateToken")}
            </Button>
          </div>

          {generatedToken && (
            <div className="space-y-3 rounded-sm border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700">{t("newTokenGeneratedLabel")}</span>
                <button
                  type="button"
                  onClick={onClearGeneratedToken}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label={t("dismissAriaLabel")}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                  <div className="break-all rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3 font-mono text-xs text-[var(--text-primary)]">
                  {generatedToken}
                </div>
                <Button variant="secondary" onClick={() => onCopyToken(generatedToken)}>
                  {t("buttonCopyToClipboard")}
                </Button>
              </div>
              <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
                <span className="text-amber-700">
                  {t("tokenOneTimeWarning")}
                </span>
              </div>
            </div>
          )}

          {syncTokensLoading ? (
            <div className="p-4 text-center text-[var(--text-muted)]">{t('loadingTokens')}</div>
          ) : syncTokens.length === 0 ? (
            <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-muted)]">
              {t('noTokensMessage')}
            </div>
          ) : (
            <div className="overflow-hidden rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)]">
              {syncTokens.map((token) => (
                <div
                  key={token.id}
                  className="space-y-3 border-b border-[var(--surface-border)] px-3 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{token.name}</div>
                        {token.isRevoked && (
                          <span className="rounded-sm border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600">
                            {t('revokedBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {t('createdLabel')}{' '}{new Date(token.createdAt).toLocaleDateString()}
                      </div>
                      {token.lastUsedAt && (
                        <div className="text-xs text-[var(--text-muted)]">
                          {t('lastUsedLabel')}{' '}{new Date(token.lastUsedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {!token.isRevoked && (
                      <Button
                        variant="danger"
                        onClick={() => onConfirmRevokeToken(token.id)}
                      >
                        {t("buttonRevoke")}
                      </Button>
                    )}
                  </div>
                  {!token.isRevoked && (
                    <div className="flex flex-col gap-2 border-t border-[var(--surface-border)] pt-2 sm:flex-row sm:items-center sm:gap-3 sm:pt-1">
                      <label htmlFor={`sync-api-key-${token.id}`} className="whitespace-nowrap text-xs font-medium text-[var(--text-muted)]">
                        {t('syncApiKeyLabel')}
                      </label>
                      <select
                        id={`sync-api-key-${token.id}`}
                        value={token.syncApiKeyId || ""}
                        onChange={(e) => onUpdateTokenApiKey(token.id, e.target.value)}
                        className="flex-1 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] transition-colors focus:border-blue-400/50 focus:outline-none"
                      >
                        {availableApiKeys.length > 0 ? (
                          <>
                            <option value="" className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                              {t('syncApiKeyAutoOption')}
                            </option>
                            {availableApiKeys.map((apiKey) => (
                              <option key={apiKey.id} value={apiKey.id} className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                                {apiKey.name}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="" className="bg-[var(--surface-base)] text-[var(--text-primary)]">
                            {t('syncApiKeyNoKeysOption')}
                          </option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--surface-border)] pt-4">
          <button
            type="button"
            onClick={onToggleInstructions}
            className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-primary)]"
          >
            <span>{showInstructions ? "▼" : "▶"}</span>
            {t("setupInstructionsToggle")}
          </button>
          {showInstructions && (
            <div className="mt-3 space-y-4 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-secondary)]">
              <div>
                <div className="font-medium text-[var(--text-primary)]">{t('setupStep1Title')}</div>
                <div className="mt-2 rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-2 font-mono text-xs">
                  {t('setupStep1Code')}
                </div>
              </div>

              <div>
                <div className="font-medium text-[var(--text-primary)] mb-3">{t('setupStep2Title')}</div>

                <div className="space-y-4">
                  <div className="rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-3">
                    <div className="mb-2 text-xs font-medium text-[var(--text-primary)]">{t('setupStandardLabel')}</div>
                    <div className="mb-2 font-mono text-xs text-[var(--text-muted)] break-all">
                      {t('setupStandardPath')}
                    </div>
                    <div className="overflow-x-auto rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-2 font-mono text-xs">
                      {`{
  "dashboardUrl": "${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard-url"}",
  "syncToken": "paste-token-here",
  "lastKnownVersion": null
}`}
                    </div>
                  </div>

                  <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <div className="mb-2 text-xs font-medium text-emerald-700">{t('setupOcxProfileLabel')}</div>
                    <div className="mb-2 font-mono text-xs text-emerald-700 break-all">
                      {t("setupOcxProfilePath")}
                    </div>
                    <div className="overflow-x-auto rounded-sm border border-[var(--surface-border)] bg-[var(--surface-base)] p-2 font-mono text-xs">
                      {`{
  "dashboardUrl": "${typeof window !== "undefined" ? window.location.origin : "https://your-dashboard-url"}",
  "syncToken": "paste-token-here",
  "lastKnownVersion": null
}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--surface-border)] pt-2 text-xs text-[var(--text-muted)]">
                {t('setupAutoInstallNote')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
