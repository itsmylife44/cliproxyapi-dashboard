"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

interface BasicFieldsProps {
  name: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  prefix: string;
  proxyUrl: string;
  isEdit: boolean;
  saving: boolean;
  errors: {
    name: string;
    providerId: string;
    baseUrl: string;
    apiKey: string;
  };
  onNameChange: (value: string) => void;
  onProviderIdChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onPrefixChange: (value: string) => void;
  onProxyUrlChange: (value: string) => void;
}

export function BasicFields({
  name,
  providerId,
  baseUrl,
  apiKey,
  prefix,
  proxyUrl,
  isEdit,
  saving,
  errors,
  onNameChange,
  onProviderIdChange,
  onBaseUrlChange,
  onApiKeyChange,
  onPrefixChange,
  onProxyUrlChange,
}: BasicFieldsProps) {
  const t = useTranslations("providers");

  return (
    <>
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {t("fieldNameLabel")} <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          name="name"
          value={name}
          onChange={onNameChange}
          placeholder={t("fieldNamePlaceholder")}
          required
          disabled={saving}
        />
        {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="providerId" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {t("fieldProviderIdLabel")} <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          name="providerId"
          value={providerId}
          onChange={onProviderIdChange}
          placeholder={t("fieldProviderIdPlaceholder")}
          required
          disabled={saving || isEdit}
          className={isEdit ? "opacity-60 cursor-not-allowed" : ""}
        />
        {errors.providerId && <p className="mt-1.5 text-xs text-red-600">{errors.providerId}</p>}
        {!errors.providerId && <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t("fieldProviderIdHint")} {isEdit ? t("fieldProviderIdHintEdit") : t("fieldProviderIdHintNew")}</p>}
      </div>

      <div>
        <label htmlFor="baseUrl" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {t("fieldBaseUrlLabel")} <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          name="baseUrl"
          value={baseUrl}
          onChange={onBaseUrlChange}
          placeholder={t("fieldBaseUrlPlaceholder")}
          required
          disabled={saving}
        />
        {errors.baseUrl && <p className="mt-1.5 text-xs text-red-600">{errors.baseUrl}</p>}
      </div>

      <div>
        <label htmlFor="apiKey" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {t("fieldApiKeyLabel")} {!isEdit && <span className="text-red-600">*</span>}
        </label>
        <Input
          type="password"
          name="apiKey"
          value={apiKey}
          onChange={onApiKeyChange}
          placeholder={isEdit ? t("fieldApiKeyEditPlaceholder") : t("fieldApiKeyPlaceholder")}
          required={!isEdit}
          disabled={saving}
        />
        {errors.apiKey && <p className="mt-1.5 text-xs text-red-600">{errors.apiKey}</p>}
        {!errors.apiKey && isEdit && <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t("fieldApiKeyEditHint")}</p>}
      </div>

      <div>
        <label htmlFor="prefix" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {t("fieldPrefixLabel")}
        </label>
        <Input
          type="text"
          name="prefix"
          value={prefix}
          onChange={onPrefixChange}
          placeholder={t("fieldPrefixPlaceholder")}
          disabled={saving}
        />
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t("fieldPrefixHint")}</p>
      </div>

      <div>
        <label htmlFor="proxyUrl" className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          {t("fieldProxyUrlLabel")}
        </label>
        <Input
          type="text"
          name="proxyUrl"
          value={proxyUrl}
          onChange={onProxyUrlChange}
          placeholder={t("fieldProxyUrlPlaceholder")}
          disabled={saving}
        />
      </div>
    </>
  );
}
