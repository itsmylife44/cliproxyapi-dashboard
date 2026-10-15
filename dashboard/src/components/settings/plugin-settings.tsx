"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Toggle } from "@/components/config/config-fields";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { mergeConfigYaml } from "@/lib/config-yaml";
import { parsePluginStore, pluginErrorMessage, type PluginRow, type PluginStoreView } from "@/lib/plugin-store";

// Upstream applies config writes with an async hot reload and can roll back a write
// that lands during the previous reload (router-for-me/CLIProxyAPI#6631), and plugins
// load in that reload. Actions stay locked until it settles, then the list refreshes.
// ponytail: fixed delay, poll GET /plugins for `registered` if 4 s proves too short.
const RELOAD_SETTLE_MS = 4000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

export function PluginSettings() {
  const t = useTranslations("settings.plugins");
  const { showToast } = useToast();
  const [view, setView] = useState<PluginStoreView | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState<PluginRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.PLUGIN_STORE);
      // The management proxy is admin-only for these routes.
      if (res.status === 401 || res.status === 403) {
        setHidden(true);
        return;
      }
      const data = await readJson(res);
      if (!res.ok) {
        setLoadError(pluginErrorMessage(data, t("loadFailed")));
        return;
      }
      setLoadError(null);
      setView(parsePluginStore(data));
    } catch {
      setLoadError(t("loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<Response>, success: string) => {
    setBusy(true);
    try {
      const res = await action();
      if (!res.ok) {
        showToast(pluginErrorMessage(await readJson(res), t("actionFailed")), "error");
        return;
      }
      showToast(success, "success");
      await sleep(RELOAD_SETTLE_MS);
      await load();
    } catch {
      showToast(t("actionFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const setGlobal = (enabled: boolean) =>
    run(async () => {
      const raw = await fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML);
      if (!raw.ok) return raw;
      // No v0 endpoint for plugins.enabled; `plugins` is a shared root in both config layouts.
      return fetch(API_ENDPOINTS.MANAGEMENT.CONFIG_YAML, {
        method: "PUT",
        headers: { "Content-Type": "text/yaml" },
        body: mergeConfigYaml(await raw.text(), { plugins: { enabled } }),
      });
    }, enabled ? t("toastGlobalOn") : t("toastGlobalOff"));

  const install = (row: PluginRow) =>
    run(
      () =>
        fetch(
          `${API_ENDPOINTS.MANAGEMENT.PLUGIN_STORE}/${encodeURIComponent(row.id)}/install?source=${encodeURIComponent(row.sourceId)}`,
          { method: "POST" }
        ),
      t("toastInstalled", { name: row.name })
    );

  const setEnabled = (row: PluginRow, enabled: boolean) =>
    run(
      () =>
        fetch(`${API_ENDPOINTS.MANAGEMENT.PLUGINS}/${encodeURIComponent(row.id)}/enabled`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }),
      enabled ? t("toastEnabled", { name: row.name }) : t("toastDisabled", { name: row.name })
    );

  const uninstall = (row: PluginRow) =>
    run(
      () => fetch(`${API_ENDPOINTS.MANAGEMENT.PLUGINS}/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
      t("toastUninstalled", { name: row.name })
    );

  const rows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (view?.rows ?? [])
      .filter((r) => !query || [r.name, r.id, r.description, ...r.tags].some((s) => s.toLowerCase().includes(query)))
      .sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name));
  }, [view, filter]);

  if (hidden) return null;

  const statusLabel = (row: PluginRow) =>
    row.active ? t("statusActive") : row.installed ? (row.enabled ? t("statusNotLoaded") : t("statusDisabled")) : null;

  return (
    <section className="rounded-lg border border-[var(--surface-border)]/70 bg-[var(--surface-base)] p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("sectionTitle")}</h2>
        <p className="text-xs text-[var(--text-muted)]">{t("sectionDescription")}</p>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!view && !loadError && <p className="text-sm text-[var(--text-muted)]">{t("loading")}</p>}

      {view && (
        <>
          <div className="flex items-start justify-between gap-4 rounded-sm border border-[var(--surface-border)] p-4">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{t("globalLabel")}</div>
              <p className="text-xs text-[var(--text-muted)]">{t("globalHelp")}</p>
            </div>
            <Toggle
              enabled={view.pluginsEnabled}
              disabled={busy}
              onChange={(next) => (next ? setConfirmEnable(true) : void setGlobal(false))}
            />
          </div>

          {view.sourceErrors.map((message) => (
            <p key={message} className="text-xs text-amber-700">{t("sourceError", { message })}</p>
          ))}

          <Input name="plugin-filter" value={filter} onChange={setFilter} placeholder={t("filterPlaceholder")} />

          <ul className="divide-y divide-[var(--surface-border)] rounded-sm border border-[var(--surface-border)]">
            {rows.length === 0 && <li className="p-4 text-sm text-[var(--text-muted)]">{t("empty")}</li>}
            {rows.map((row) => {
              const status = statusLabel(row);
              return (
                <li key={`${row.sourceId}/${row.id}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{row.name}</span>
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {row.installed ? row.installedVersion : row.version}
                      </span>
                      {status && (
                        <span className="rounded-sm border border-[var(--surface-border)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                          {status}
                        </span>
                      )}
                      {row.tags.map((tag) => (
                        <span key={tag} className="rounded-sm bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="line-clamp-2 text-xs text-[var(--text-muted)]">{row.description}</p>
                    {row.author && <p className="text-xs text-[var(--text-muted)]">{t("byAuthor", { author: row.author })}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!row.installed && (
                      <Button variant="secondary" disabled={busy} onClick={() => void install(row)}>{t("install")}</Button>
                    )}
                    {row.installed && row.updateAvailable && (
                      <Button variant="secondary" disabled={busy} onClick={() => void install(row)}>
                        {t("update", { version: row.version })}
                      </Button>
                    )}
                    {row.installed && (
                      <Button variant="ghost" disabled={busy} onClick={() => void setEnabled(row, !row.enabled)}>
                        {row.enabled ? t("disable") : t("enable")}
                      </Button>
                    )}
                    {row.installed && (
                      <Button variant="danger" disabled={busy} onClick={() => setConfirmUninstall(row)}>{t("uninstall")}</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmEnable}
        onClose={() => setConfirmEnable(false)}
        onConfirm={() => {
          setConfirmEnable(false);
          void setGlobal(true);
        }}
        title={t("confirmEnableTitle")}
        message={t("confirmEnableMessage")}
        confirmLabel={t("confirmEnableLabel")}
        variant="warning"
      />
      <ConfirmDialog
        isOpen={confirmUninstall !== null}
        onClose={() => setConfirmUninstall(null)}
        onConfirm={() => {
          const row = confirmUninstall;
          setConfirmUninstall(null);
          if (row) void uninstall(row);
        }}
        title={t("confirmUninstallTitle")}
        message={t("confirmUninstallMessage", { name: confirmUninstall?.name ?? "" })}
        confirmLabel={t("uninstall")}
        variant="danger"
      />
    </section>
  );
}
