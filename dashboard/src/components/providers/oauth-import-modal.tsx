"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import type { OAuthProviderId, ShowToast } from "./oauth-types";
import { getOAuthProviderById, MAX_IMPORT_FILE_SIZE } from "./oauth-types";

type ImportStatus = "idle" | "validating" | "uploading" | "success" | "error";

interface OAuthImportModalProps {
  isOpen: boolean;
  providerId: OAuthProviderId | null;
  showToast: ShowToast;
  refreshProviders: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  onClose: () => void;
}

function validateImportJson(content: string): { valid: boolean; error: string | null } {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { valid: false, error: "File must contain a JSON object, not an array." };
    }
    return { valid: true, error: null };
  } catch {
    return { valid: false, error: "Invalid JSON content." };
  }
}

export function OAuthImportModal({ isOpen, providerId, showToast, refreshProviders, loadAccounts, onClose }: OAuthImportModalProps) {
  const [jsonContent, setJsonContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setJsonContent("");
    setFileName("");
    setStatus("idle");
    setErrorMessage(null);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setFileName("");
      setJsonContent("");
      setErrorMessage("Please select a JSON file.");
      setStatus("error");
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setFileName("");
      setJsonContent("");
      setErrorMessage("File is too large (max 1MB).");
      setStatus("error");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setJsonContent(content);
        const result = validateImportJson(content);
        if (!result.valid) {
          setErrorMessage(result.error);
          setStatus("error");
        } else {
          setErrorMessage(null);
          setStatus("idle");
        }
      }
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read file.");
      setStatus("error");
    };
    reader.readAsText(file);
  };

  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    if (value.trim()) {
      const result = validateImportJson(value);
      setErrorMessage(result.error);
      setStatus(result.valid ? "idle" : "error");
    } else {
      setErrorMessage(null);
      setStatus("idle");
    }
  };

  const handleSubmit = async () => {
    if (!providerId || !jsonContent.trim()) return;

    const result = validateImportJson(jsonContent);
    if (!result.valid) {
      setErrorMessage(result.error);
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/providers/oauth/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          fileName: fileName || `${providerId}-credential.json`,
          fileContent: jsonContent.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Failed to import credential.");
        return;
      }

      setStatus("success");
      showToast("OAuth credential imported successfully", "success");
      await refreshProviders();
      void loadAccounts();
    } catch {
      setStatus("error");
      setErrorMessage("Network error while importing credential.");
    }
  };

  const providerName = providerId ? getOAuthProviderById(providerId)?.name || providerId : "";

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader>
        <ModalTitle>Import {providerName} Credential</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          <div className="rounded-xl border-l-4 border-blue-400/60 bg-blue-500/10 p-4 text-sm backdrop-blur-xl">
            <div className="font-medium text-white">Import a local OAuth credential</div>
            <p className="mt-2 text-white/80">
              Upload a JSON credential file or paste the raw JSON content below.
              The credential will be imported and connected to your account.
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-white/90">Upload JSON file</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-600 file:cursor-pointer file:transition-colors"
              disabled={status === "uploading"}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex items-center justify-center">
              <span className="bg-slate-900 px-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">or paste JSON</span>
            </div>
            <div className="border-t border-slate-700/50 pt-4 mt-2">
              <textarea
                value={jsonContent}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='{&#10;  "access_token": "...",&#10;  "refresh_token": "...",&#10;  ...&#10;}'
                rows={8}
                disabled={status === "uploading"}
                className="w-full rounded-md border border-slate-700/70 bg-slate-800/50 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 resize-y"
              />
            </div>
          </div>

          {status === "error" && errorMessage && (
            <div className="rounded-xl border-l-4 border-red-400/60 bg-red-500/20 p-3 text-xs text-white backdrop-blur-xl">{errorMessage}</div>
          )}

          {status === "success" && (
            <div className="rounded-xl border-l-4 border-green-400/60 bg-green-500/20 p-3 text-xs text-white backdrop-blur-xl">Credential imported successfully.</div>
          )}

          {jsonContent.trim() && status !== "error" && status !== "success" && (
            <div className="rounded-xl border-l-4 border-green-400/60 bg-green-500/10 p-2 text-xs text-white/70 backdrop-blur-xl">
              JSON content loaded ({jsonContent.length.toLocaleString()} characters). Ready to import.
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={handleClose}>{status === "success" ? "Done" : "Cancel"}</Button>
        {status !== "success" && (
          <Button variant="secondary" onClick={handleSubmit} disabled={!jsonContent.trim() || status === "uploading"}>
            {status === "uploading" ? "Importing..." : "Import Credential"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
