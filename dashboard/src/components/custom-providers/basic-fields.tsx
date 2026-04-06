"use client";

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
  return (
    <>
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-semibold text-black">
          Name <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          name="name"
          value={name}
          onChange={onNameChange}
          placeholder="My Custom Provider"
          required
          disabled={saving}
        />
        {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="providerId" className="mb-2 block text-sm font-semibold text-black">
          Provider ID <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          name="providerId"
          value={providerId}
          onChange={onProviderIdChange}
          placeholder="my-custom-provider"
          required
          disabled={saving || isEdit}
          className={isEdit ? "opacity-60 cursor-not-allowed" : ""}
        />
        {errors.providerId && <p className="mt-1.5 text-xs text-red-600">{errors.providerId}</p>}
        {!errors.providerId && <p className="mt-1.5 text-xs text-[#777169]">Lowercase alphanumeric with hyphens. {isEdit ? "Cannot be changed." : "Auto-generated from name."}</p>}
      </div>

      <div>
        <label htmlFor="baseUrl" className="mb-2 block text-sm font-semibold text-black">
          Base URL <span className="text-red-600">*</span>
        </label>
        <Input
          type="text"
          name="baseUrl"
          value={baseUrl}
          onChange={onBaseUrlChange}
          placeholder="https://api.example.com/v1"
          required
          disabled={saving}
        />
        {errors.baseUrl && <p className="mt-1.5 text-xs text-red-600">{errors.baseUrl}</p>}
      </div>

      <div>
        <label htmlFor="apiKey" className="mb-2 block text-sm font-semibold text-black">
          API Key {!isEdit && <span className="text-red-600">*</span>}
        </label>
        <Input
          type="password"
          name="apiKey"
          value={apiKey}
          onChange={onApiKeyChange}
          placeholder={isEdit ? "Leave empty to keep existing key" : "sk-..."}
          required={!isEdit}
          disabled={saving}
        />
        {errors.apiKey && <p className="mt-1.5 text-xs text-red-600">{errors.apiKey}</p>}
        {!errors.apiKey && isEdit && <p className="mt-1.5 text-xs text-[#777169]">Leave empty to keep existing API key</p>}
      </div>

      <div>
        <label htmlFor="prefix" className="mb-2 block text-sm font-semibold text-black">
          Prefix (Optional)
        </label>
        <Input
          type="text"
          name="prefix"
          value={prefix}
          onChange={onPrefixChange}
          placeholder="custom/"
          disabled={saving}
        />
        <p className="mt-1.5 text-xs text-[#777169]">Model name prefix for routing</p>
      </div>

      <div>
        <label htmlFor="proxyUrl" className="mb-2 block text-sm font-semibold text-black">
          Proxy URL (Optional)
        </label>
        <Input
          type="text"
          name="proxyUrl"
          value={proxyUrl}
          onChange={onProxyUrlChange}
          placeholder="http://proxy.example.com:8080"
          disabled={saving}
        />
      </div>
    </>
  );
}
