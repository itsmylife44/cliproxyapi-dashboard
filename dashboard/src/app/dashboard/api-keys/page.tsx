"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedKey(id ?? text);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  return { copiedKey, copy };
}

const EMPTY_KEYS: ApiKey[] = [];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(EMPTY_KEYS);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyNameInput, setKeyNameInput] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyToClipboard();

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys");
      if (!res.ok) {
        showToast("Failed to load API keys", "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const keys = Array.isArray(data.apiKeys) ? data.apiKeys : [];
      setApiKeys(keys);
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    setCreating(true);

    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyNameInput.trim() || "Default" }),
      });

      if (!res.ok) {
        showToast("Failed to create API key", "error");
        setCreating(false);
        return;
      }

      const newKey = await res.json();
      showToast("API key created successfully", "success");
      setNewKeyValue(newKey.key);
      setIsCreateModalOpen(false);
      setIsModalOpen(true);
      setCreating(false);
      await fetchApiKeys();
    } catch {
      showToast("Network error", "error");
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const res = await fetch(
        `/api/user/api-keys?id=${encodeURIComponent(id)}`,
        {
        method: "DELETE",
        }
      );

      if (!res.ok) {
        showToast("Failed to delete API key", "error");
        return;
      }

      showToast("API key deleted successfully", "success");
      setApiKeys((prev) => prev.filter((item) => item.id !== id));
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewKeyValue(null);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">API Keys</h1>
            <p className="mt-1 text-xs text-slate-400">Manage dashboard access keys for clients and integrations.</p>
          </div>
          <Button onClick={() => { setKeyNameInput(""); setIsCreateModalOpen(true); }} disabled={creating} className="px-2.5 py-1 text-xs">
            Create Key
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">Loading...</div>
      ) : apiKeys.length === 0 ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4 text-sm text-slate-400">
          No API keys configured. Create one to get started.
        </div>
      ) : (
        <section className="overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/25">
          <div className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] border-b border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span>Name</span>
            <span>Created</span>
            <span>Last Used</span>
            <span>Actions</span>
          </div>
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="grid grid-cols-[minmax(0,1fr)_180px_160px_110px] items-center border-b border-slate-700/60 px-3 py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-100">{apiKey.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{apiKey.keyPreview}</p>
              </div>
              <span className="text-xs text-slate-400">{new Date(apiKey.createdAt).toLocaleDateString()}</span>
              <span className="text-xs text-slate-400">{apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : "Never"}</span>
              <div className="flex justify-end">
                <Button variant="danger" onClick={() => handleDeleteKey(apiKey.id)} className="px-2.5 py-1 text-xs">
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Create Key Modal ── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>Create API Key</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="key-name-input" className="mb-2 block text-sm font-semibold text-slate-300">
                Key Name
              </label>
              <Input
                type="text"
                name="key-name-input"
                value={keyNameInput}
                onChange={setKeyNameInput}
                placeholder="e.g. Development, Production, CLI"
                disabled={creating}
              />
              <p className="mt-1.5 text-xs text-slate-500">Give your key a descriptive name for easy identification</p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateKey} disabled={creating}>
            {creating ? "Creating..." : "Create Key"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={isModalOpen && newKeyValue !== null} onClose={handleCloseModal}>
        <ModalHeader>
          <ModalTitle>New API Key</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="rounded-sm border border-slate-700/70 bg-slate-900/40 p-4 text-sm">
              <div className="mb-2 font-medium text-slate-100">Copy this key now</div>
              <div className="relative group">
                <div className="break-all rounded-sm border border-slate-700/70 bg-slate-900/40 p-3 pr-12 font-mono text-xs text-slate-200">
                  {newKeyValue}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (newKeyValue) {
                      copy(newKeyValue, "modal");
                      showToast("API key copied", "success");
                    }
                  }}
                  className="absolute right-2.5 top-2.5 rounded-sm border border-slate-700/70 bg-slate-800/60 p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-700/70 hover:text-slate-200"
                  title="Copy API key"
                >
                  {copiedKey === "modal" ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
            <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <span className="text-amber-200">This key will only be shown once. Store it securely.</span>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={handleCloseModal}>I have saved it</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
