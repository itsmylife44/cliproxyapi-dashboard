"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { extractApiError } from "@/lib/utils";
import { BasicFields } from "@/components/custom-providers/basic-fields";
import { HeadersSection } from "@/components/custom-providers/headers-section";
import { ModelDiscovery } from "@/components/custom-providers/model-discovery";
import { ModelMappings } from "@/components/custom-providers/model-mappings";
import { ExcludedModels } from "@/components/custom-providers/excluded-models";
import { GroupSelect } from "@/components/custom-providers/group-select";

import { useTranslations } from "next-intl";
interface ModelMapping {
  _id: number;
  upstreamName: string;
  alias: string;
}

interface ApiModelMapping {
  upstreamName: string;
  alias: string;
}

interface CustomProvider {
  id: string;
  name: string;
  providerId: string;
  baseUrl: string;
  prefix: string | null;
  proxyUrl: string | null;
  headers: Record<string, string>;
  models: ApiModelMapping[];
  excludedModels: { pattern: string }[];
  groupId: string | null;
}

interface CustomProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: CustomProvider;
  onSuccess: () => void;
}

interface HeaderEntry {
  _id: number;
  key: string;
  value: string;
}

interface FetchedModel {
  id: string;
  selected: boolean;
}

function generateProviderId(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

let _nextId = 0;
function nextId() { return ++_nextId; }

function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function CustomProviderModal({ isOpen, onClose, provider, onSuccess }: CustomProviderModalProps) {
  const { showToast } = useToast();
  const isEdit = !!provider;
  const t = useTranslations("providers");

  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prefix, setPrefix] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);
  const [models, setModels] = useState<ModelMapping[]>([{ _id: nextId(), upstreamName: "", alias: "" }]);
  const [excludedModels, setExcludedModels] = useState<string[]>([]);
  const excludedModelIds = useRef<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [showFetchedModels, setShowFetchedModels] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<{id: string; name: string; color: string | null}[]>([]);

  const [errors, setErrors] = useState({
    name: "",
    providerId: "",
    baseUrl: "",
    apiKey: "",
    models: ""
  });

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.PROVIDER_GROUPS.BASE);
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups || []);
        }
      } catch {
      }
    };
    void fetchGroups();
  }, []);

  const resetForm = useCallback(() => {
    setName("");
    setProviderId("");
    setBaseUrl("");
    setApiKey("");
    setPrefix("");
    setProxyUrl("");
    setHeaders([]);
    setModels([{ _id: nextId(), upstreamName: "", alias: "" }]);
    setExcludedModels([]);
    excludedModelIds.current = [];
    setErrors({ name: "", providerId: "", baseUrl: "", apiKey: "", models: "" });
    setFetchingModels(false);
    setFetchedModels([]);
    setShowFetchedModels(false);
    setGroupId(null);
  }, []);

  useEffect(() => {
    if (provider) {
      setName(provider.name);
      setProviderId(provider.providerId);
      setBaseUrl(provider.baseUrl);
      setPrefix(provider.prefix || "");
      setProxyUrl(provider.proxyUrl || "");
      setHeaders(Object.entries(provider.headers || {}).map(([key, value]) => ({ _id: nextId(), key, value })));
      setModels(provider.models.length > 0 ? provider.models.map(m => ({ ...m, _id: nextId() })) : [{ _id: nextId(), upstreamName: "", alias: "" }]);
      setExcludedModels(provider.excludedModels.map(e => e.pattern));
      excludedModelIds.current = provider.excludedModels.map(() => nextId());
      setGroupId(provider.groupId);
      setApiKey("");
      return;
    }

    resetForm();
  }, [provider, resetForm]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEdit) {
      setProviderId(generateProviderId(value));
    }
  };

  const validate = () => {
    const newErrors = {
      name: name.length === 0 ? t("validationNameRequired") : name.length > 100 ? t("validationNameMaxLength") : "",
      providerId: !/^[a-z0-9-]+$/.test(providerId) ? t("validationProviderIdInvalid") : "",
      baseUrl: !isValidBaseUrl(baseUrl) ? t("validationBaseUrlInvalid") : "",
      apiKey: !isEdit && apiKey.length === 0 ? t("validationApiKeyRequired") : "",
      models: models.filter(m => m.upstreamName && m.alias).length === 0 ? t("validationModelsRequired") : ""
    };

    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === "");
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);

    const validModels = models.filter(m => m.upstreamName && m.alias);
    const headersObj = headers.reduce((acc, h) => {
      if (h.key && h.value) acc[h.key] = h.value;
      return acc;
    }, {} as Record<string, string>);

    const payload = {
      name,
      providerId,
      baseUrl,
      ...(apiKey ? { apiKey } : {}),
      prefix: prefix || undefined,
      proxyUrl: proxyUrl || undefined,
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      models: validModels,
      excludedModels: excludedModels.filter(e => e.trim()),
      groupId: groupId || null
    };

    try {
      const url = isEdit ? `/api/custom-providers/${provider.id}` : "/api/custom-providers";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showToast(isEdit ? t("toastProviderUpdated") : t("toastProviderCreated"), "success");
        onSuccess();
        onClose();
        resetForm();
      } else {
        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        showToast(extractApiError(data, t("toastSaveFailed")), "error");
      }
    } catch {
      showToast(t("toastNetworkError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const addModelMapping = () => {
    setModels([...models, { _id: nextId(), upstreamName: "", alias: "" }]);
  };

  const removeModelMapping = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const updateModelMapping = (index: number, field: 'upstreamName' | 'alias', value: string) => {
    const updated = [...models];
    updated[index][field] = value;
    setModels(updated);
  };

  const addHeader = () => {
    setHeaders([...headers, { _id: nextId(), key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const addExcludedModel = () => {
    excludedModelIds.current = [...excludedModelIds.current, nextId()];
    setExcludedModels([...excludedModels, ""]);
  };

  const removeExcludedModel = (index: number) => {
    excludedModelIds.current = excludedModelIds.current.filter((_, i) => i !== index);
    setExcludedModels(excludedModels.filter((_, i) => i !== index));
  };

  const updateExcludedModel = (index: number, value: string) => {
    const updated = [...excludedModels];
    updated[index] = value;
    setExcludedModels(updated);
  };

  const fetchModelsHandler = async () => {
    if (!isValidBaseUrl(baseUrl) || apiKey.length === 0) {
      showToast(t("toastFetchModelsInvalid"), "error");
      return;
    }

    setFetchingModels(true);
    setFetchedModels([]);
    setShowFetchedModels(false);

    try {
      const response = await fetch(API_ENDPOINTS.CUSTOM_PROVIDERS.FETCH_MODELS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey })
      });

      if (response.ok) {
        const data = await response.json();
        const existingModelIds = new Set(models.filter(m => m.upstreamName).map(m => m.upstreamName));

        const fetchedList: FetchedModel[] = data.models.map((model: { id: string }) => ({
          id: model.id,
          selected: existingModelIds.has(model.id)
        }));

        setFetchedModels(fetchedList);
        setShowFetchedModels(true);
        showToast(t("toastFetchModelsSuccess", { count: fetchedList.length }), "success");
      } else {
        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        showToast(extractApiError(data, t("toastFetchModelsFailed")), "error");
      }
    } catch {
      showToast(t("toastNetworkError"), "error");
    } finally {
      setFetchingModels(false);
    }
  };

  const toggleFetchedModel = (id: string) => {
    setFetchedModels(prev =>
      prev.map(model =>
        model.id === id ? { ...model, selected: !model.selected } : model
      )
    );
  };

  const toggleAllFetchedModels = () => {
    const allSelected = fetchedModels.every(m => m.selected);
    setFetchedModels(prev => prev.map(model => ({ ...model, selected: !allSelected })));
  };

  const addSelectedModels = () => {
    const selectedModels = fetchedModels.filter(m => m.selected);
    const existingModelIds = new Set(models.filter(m => m.upstreamName).map(m => m.upstreamName));

    const newModels = selectedModels
      .filter(model => !existingModelIds.has(model.id))
      .map(model => ({
        _id: nextId(),
        upstreamName: model.id,
        alias: model.id
      }));

    if (newModels.length > 0) {
      setModels(prev => {
        const existing = prev.filter(m => m.upstreamName || m.alias);
        return [...existing, ...newModels];
      });
      showToast(t("toastModelsAdded", { count: newModels.length }), "success");
    }

    setShowFetchedModels(false);
    setFetchedModels([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-3xl">
      <ModalHeader>
        <ModalTitle>{isEdit ? t("customProviderEditTitle") : t("customProviderAddTitle")}</ModalTitle>
      </ModalHeader>

      <ModalContent>
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2">
          <BasicFields
            name={name}
            providerId={providerId}
            baseUrl={baseUrl}
            apiKey={apiKey}
            prefix={prefix}
            proxyUrl={proxyUrl}
            isEdit={isEdit}
            saving={saving}
            errors={errors}
            onNameChange={handleNameChange}
            onProviderIdChange={setProviderId}
            onBaseUrlChange={setBaseUrl}
            onApiKeyChange={setApiKey}
            onPrefixChange={setPrefix}
            onProxyUrlChange={setProxyUrl}
          />

          <HeadersSection
            headers={headers}
            saving={saving}
            onAddHeader={addHeader}
            onRemoveHeader={removeHeader}
            onUpdateHeader={updateHeader}
          />

          <ModelDiscovery
            canFetchModels={isValidBaseUrl(baseUrl) && apiKey.length > 0}
            apiKey={apiKey}
            fetchingModels={fetchingModels}
            saving={saving}
            fetchedModels={fetchedModels}
            showFetchedModels={showFetchedModels}
            onFetchModels={fetchModelsHandler}
            onToggleFetchedModel={toggleFetchedModel}
            onToggleAllFetchedModels={toggleAllFetchedModels}
            onAddSelectedModels={addSelectedModels}
          />

          <ModelMappings
            models={models}
            saving={saving}
            error={errors.models}
            onAddModelMapping={addModelMapping}
            onRemoveModelMapping={removeModelMapping}
            onUpdateModelMapping={updateModelMapping}
          />

          <ExcludedModels
            excludedModels={excludedModels}
            excludedModelIds={excludedModelIds.current}
            saving={saving}
            onAddExcludedModel={addExcludedModel}
            onRemoveExcludedModel={removeExcludedModel}
            onUpdateExcludedModel={updateExcludedModel}
          />

          <GroupSelect
            groupId={groupId}
            groups={groups}
            saving={saving}
            onGroupIdChange={setGroupId}
          />
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t("customProviderCancelButton")}
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? (isEdit ? t("customProviderUpdatingButton") : t("customProviderCreatingButton")) : (isEdit ? t("customProviderUpdateButton") : t("customProviderCreateButton"))}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
