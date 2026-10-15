"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { Toggle } from "@/components/config/config-fields";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { writeConfigYamlChanges } from "@/lib/config-yaml-write";
import { isRecord } from "@/lib/utils";
import { parsePluginConfigFields, type PluginConfigField } from "@/lib/plugin-config";
import { PluginConfigForm } from "@/components/settings/plugin-config-form";
import {
  parsePluginStore,
  pluginErrorMessage,
  waitForPluginState,
  type PluginRow,
  type PluginStoreView,
  type PluginTarget,
} from "@/lib/plugin-store";

// Upstream applies config writes with an async hot reload and can roll back a write
// that lands during the previous reload (router-for-me/CLIProxyAPI#6631), and plugins
// load in that reload. After every write, actions stay locked until the affected plugins
// settle and for at least PLUGIN_SETTLE_MIN_MS (see waitForPluginState).

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

export function PluginSettings() {
  const t = useTranslations("settings.plugins");
  const { showToast } = useToast();
  // Admin-only: gate on the session so non-admins never see the section while the store loads.
  const isAdmin = useAuth().user?.isAdmin === true;
  const [view, setView] = useState<PluginStoreView | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState<PluginRow | null>(null);
  const [fieldsById, setFieldsById] = useState<Record<string, PluginConfigField[]>>({});
  const [editing, setEditing] = useState<{ id: string; config: Record<string, unknown> } | null>(null);

  // The store has no settings schema; GET /plugins has it for loaded plugins.
  const loadFields = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.PLUGINS);
      if (res.ok) setFieldsById(parsePluginConfigFields(await readJson(res)));
    } catch {
      // Without a schema the settings buttons stay hidden.
    }
  }, []);

  const load = useCallback(async (): Promise<PluginStoreView | null> => {
    void loadFields();
    try {
      const res = await fetch(API_ENDPOINTS.MANAGEMENT.PLUGIN_STORE);
      // The management proxy is admin-only for these routes.
      if (res.status === 401 || res.status === 403) {
        setHidden(true);
        return null;
      }
      const data = await readJson(res);
      if (!res.ok) {
        setLoadError(pluginErrorMessage(data, t("loadFailed")));
        return null;
      }
      const next = parsePluginStore(data);
      setLoadError(null);
      setView(next);
      return next;
    } catch {
      setLoadError(t("loadFailed"));
      return null;
    }
  }, [t, loadFields]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  /** Resolves true once the write succeeded (whether or not the plugins settled in time). */
  const run = async (action: () => Promise<Response>, success: string, target: PluginTarget): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await action();
      if (!res.ok) {
        showToast(pluginErrorMessage(await readJson(res), t("actionFailed")), "error");
        return false;
      }
      showToast(success, "success");
      setSettling(target.ids);
      const { view: settled, pending } = await waitForPluginState(load, target);
      if (pending.length > 0) {
        const names = pending.map((id) => settled?.rows.find((r) => r.id === id)?.name ?? id).join(", ");
        showToast(t("settleTimeout", { names }), "error");
      }
      return true;
    } catch {
      showToast(t("actionFailed"), "error");
      return false;
    } finally {
      setSettling([]);
      setBusy(false);
    }
  };

  const configUrl = (row: PluginRow) => `${API_ENDPOINTS.MANAGEMENT.PLUGINS}/${encodeURIComponent(row.id)}/config`;

  const openSettings = async (row: PluginRow) => {
    try {
      const res = await fetch(configUrl(row));
      const data = await readJson(res);
      if (res.ok && isRecord(data)) {
        setEditing({ id: row.id, config: data });
        return;
      }
      showToast(pluginErrorMessage(data, t("configLoadFailed")), "error");
    } catch {
      showToast(t("configLoadFailed"), "error");
    }
  };

  // PATCH only: upstream's PUT replaces the entry, disabling the plugin and dropping its store record.
  const saveSettings = async (row: PluginRow, patch: Record<string, unknown>) => {
    const saved = await run(
      () =>
        fetch(configUrl(row), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
      t("toastConfigSaved", { name: row.name }),
      { ids: [row.id] }
    );
    if (saved) setEditing(null);
  };

  const setGlobal = (enabled: boolean) =>
    // No v0 endpoint for plugins.enabled; `plugins` is a shared root in both config layouts.
    run(
      async () => (await writeConfigYamlChanges({ plugins: { enabled } })).res,
      enabled ? t("toastGlobalOn") : t("toastGlobalOff"),
      { ids: (view?.rows ?? []).filter((r) => r.installed).map((r) => r.id), pluginsEnabled: enabled }
    );

  const install = (row: PluginRow) =>
    run(
      () =>
        fetch(
          `${API_ENDPOINTS.MANAGEMENT.PLUGIN_STORE}/${encodeURIComponent(row.id)}/install?source=${encodeURIComponent(row.sourceId)}`,
          { method: "POST" }
        ),
      t("toastInstalled", { name: row.name }),
      // An update is done once the new version is the installed one, not just loaded.
      { ids: [row.id], installedVersion: row.installed ? row.version : undefined }
    );

  const setEnabled = (row: PluginRow, enabled: boolean) =>
    run(
      () =>
        fetch(`${API_ENDPOINTS.MANAGEMENT.PLUGINS}/${encodeURIComponent(row.id)}/enabled`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }),
      enabled ? t("toastEnabled", { name: row.name }) : t("toastDisabled", { name: row.name }),
      { ids: [row.id] }
    );

  const uninstall = (row: PluginRow) =>
    run(
      () => fetch(`${API_ENDPOINTS.MANAGEMENT.PLUGINS}/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
      t("toastUninstalled", { name: row.name }),
      { ids: [row.id] }
    );

  const rows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (view?.rows ?? [])
      .filter((r) => !query || [r.name, r.id, r.description, ...r.tags].some((s) => s.toLowerCase().includes(query)))
      .sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name));
  }, [view, filter]);

  if (!isAdmin || hidden) return null;

  const statusLabel = (row: PluginRow) =>
    settling.includes(row.id) ? t("statusApplying") : row.active ? t("statusActive") : row.installed ? (row.enabled ? t("statusNotLoaded") : t("statusDisabled")) : null;

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
              // Upstream publishes the settings schema only for loaded plugins.
              const fields = row.loaded ? (fieldsById[row.id] ?? []) : [];
              const editingThis = editing?.id === row.id;
              return (
                <li key={`${row.sourceId}/${row.id}`} className="space-y-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                      {fields.length > 0 && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => (editingThis ? setEditing(null) : void openSettings(row))}
                        >
                          {editingThis ? t("hideSettings") : t("settings")}
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
                  </div>
                  {editingThis && editing && (
                    <PluginConfigForm
                      fields={fields}
                      config={editing.config}
                      busy={busy}
                      onSave={(patch) => void saveSettings(row, patch)}
                      onCancel={() => setEditing(null)}
                    />
                  )}
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
