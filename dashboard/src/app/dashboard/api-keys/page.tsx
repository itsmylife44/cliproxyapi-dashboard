"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
       <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
           API Keys
         </h1>
         <Button onClick={() => { setKeyNameInput(""); setIsCreateModalOpen(true); }} disabled={creating}>
           Create New Key
         </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
        </CardHeader>
        <CardContent>
            {loading ? (
              <div className="p-8 text-center text-white">Loading...</div>
            ) : apiKeys.length === 0 ? (
              <div className="border-l-4 border-white/30 backdrop-blur-xl bg-white/5 p-4 text-sm text-white/80 rounded-r-xl">
                No API keys configured. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">
                      {apiKey.name}
                    </div>
                    <div className="mt-1 text-xs text-white/70 font-mono truncate">
                      {apiKey.keyPreview}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteKey(apiKey.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Key Modal ── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalHeader>
          <ModalTitle>Create API Key</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="key-name-input" className="mb-2 block text-sm font-semibold text-white">
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
              <p className="mt-1.5 text-xs text-white/50">Give your key a descriptive name for easy identification</p>
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
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-4 text-sm rounded-xl">
              <div className="mb-2 font-medium text-white">Copy this key now</div>
              <div className="relative group">
                <div className="break-all backdrop-blur-xl bg-white/5 border border-white/20 p-3 pr-12 text-xs text-white font-mono rounded-lg">
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
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-md border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all duration-200 active:scale-95"
                  title="Copy API key"
                >
                  {copiedKey === "modal" ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
            <div className="border-l-4 border-yellow-400/60 bg-yellow-500/20 backdrop-blur-xl p-3 text-sm rounded-r-xl">
              <span className="text-white/90">This key will only be shown once. Store it securely.</span>
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
