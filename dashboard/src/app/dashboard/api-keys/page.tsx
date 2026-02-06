"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const EMPTY_KEYS: string[] = [];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<string[]>(EMPTY_KEYS);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/management/api-keys");
      if (!res.ok) {
        showToast("Failed to load API keys", "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const keys = Array.isArray(data["api-keys"]) ? data["api-keys"] : [];
      setApiKeys(keys);
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    setCreating(true);

    try {
      const generatedKey = crypto.randomUUID();
      const nextKeys = [...apiKeys, generatedKey];
      const res = await fetch("/api/management/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextKeys),
      });

      if (!res.ok) {
        showToast("Failed to create API key", "error");
        setCreating(false);
        return;
      }

      showToast("API key created successfully", "success");
      setNewKeyValue(generatedKey);
      setApiKeys(nextKeys);
      setIsModalOpen(true);
      setCreating(false);
    } catch {
      showToast("Network error", "error");
      setCreating(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const res = await fetch(
        `/api/management/api-keys?value=${encodeURIComponent(key)}`,
        {
        method: "DELETE",
        }
      );

      if (!res.ok) {
        showToast("Failed to delete API key", "error");
        return;
      }

      showToast("API key deleted successfully", "success");
      setApiKeys((prev) => prev.filter((item) => item !== key));
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
        <Button onClick={handleCreateKey} disabled={creating}>
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
                  key={apiKey}
                  className="flex items-center justify-between backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      API Key
                    </div>
                    <div className="mt-1 text-xs text-white/70 font-mono">
                      {apiKey.substring(0, 8)}...
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteKey(apiKey)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen && newKeyValue !== null} onClose={handleCloseModal}>
        <ModalHeader>
          <ModalTitle>New API Key</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-4 text-sm rounded-xl">
              <div className="mb-2 font-medium text-white">Copy this key now</div>
              <div className="break-all backdrop-blur-xl bg-white/5 border border-white/20 p-3 text-xs text-white font-mono rounded-lg">
                {newKeyValue}
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
