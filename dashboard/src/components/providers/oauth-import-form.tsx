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
              onChange={onFileSelect}
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
                onChange={(e) => onJsonChange(e.target.value)}
                placeholder='{&#10;  "access_token": "...",&#10;  "refresh_token": "...",&#10;  ...&#10;}'
                rows={8}
                disabled={status === "uploading"}
                className="w-full rounded-md border border-slate-700/70 bg-slate-800/50 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 resize-y"
              />
            </div>
          </div>

          {status === "error" && errorMessage && (
            <div className="rounded-xl border-l-4 border-red-400/60 bg-red-500/20 p-3 text-xs text-white backdrop-blur-xl">
              {errorMessage}
            </div>
          )}

          {status === "success" && (
            <div className="rounded-xl border-l-4 border-green-400/60 bg-green-500/20 p-3 text-xs text-white backdrop-blur-xl">
              Credential imported successfully.
            </div>
          )}

          {jsonContent.trim() && status !== "error" && status !== "success" && (
            <div className="rounded-xl border-l-4 border-green-400/60 bg-green-500/10 p-2 text-xs text-white/70 backdrop-blur-xl">
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
