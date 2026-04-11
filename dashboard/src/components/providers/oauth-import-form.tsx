"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";

interface OAuthImportFormProps {
  isOpen: boolean;
  providerName: string;
  jsonContent: string;
  fileName: string;
  status: "idle" | "validating" | "uploading" | "success" | "error";
  errorMessage: string | null;
  onClose: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJsonChange: (value: string) => void;
  onSubmit: () => void;
}

export function OAuthImportForm({
  isOpen,
  providerName,
  jsonContent,
  status,
  errorMessage,
  onClose,
  onFileSelect,
  onJsonChange,
  onSubmit,
}: OAuthImportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>
          Import {providerName} Credential
        </ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          <div className="rounded-xl border-l-4 border-blue-300 bg-blue-50 p-4 text-sm">
            <div className="font-medium text-[var(--text-primary)]">Import a local OAuth credential</div>
            <p className="mt-2 text-[var(--text-secondary)]">
              Upload a JSON credential file or paste the raw JSON content below.
              The credential will be imported and connected to your account.
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-[var(--text-primary)]">Upload JSON file</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={onFileSelect}
              className="block w-full text-xs text-[var(--text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[#e5e5e5] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--text-primary)] hover:file:bg-[#e5e5e5] file:cursor-pointer file:transition-colors"
              disabled={status === "uploading"}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex items-center justify-center">
              <span className="bg-[var(--surface-base)] px-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">or paste JSON</span>
            </div>
            <div className="border-t border-[var(--surface-border)] pt-4 mt-2">
              <textarea
                value={jsonContent}
                onChange={(e) => onJsonChange(e.target.value)}
                placeholder='{&#10;  "access_token": "...",&#10;  "refresh_token": "...",&#10;  ...&#10;}'
                rows={8}
                disabled={status === "uploading"}
                className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 resize-y"
              />
            </div>
          </div>

          {status === "error" && errorMessage && (
            <div className="rounded-xl border-l-4 border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          {status === "success" && (
            <div className="rounded-xl border-l-4 border-green-300 bg-green-50 p-3 text-xs text-green-700">
              Credential imported successfully.
            </div>
          )}

          {jsonContent.trim() && status !== "error" && status !== "success" && (
            <div className="rounded-xl border-l-4 border-green-300 bg-green-50 p-2 text-xs text-[var(--text-secondary)]">
              JSON content loaded ({jsonContent.length.toLocaleString()} characters). Ready to import.
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {status === "success" ? "Done" : "Cancel"}
        </Button>
        {status !== "success" && (
          <Button
            variant="secondary"
            onClick={onSubmit}
            disabled={!jsonContent.trim() || status === "uploading"}
          >
            {status === "uploading" ? "Importing..." : "Import Credential"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
