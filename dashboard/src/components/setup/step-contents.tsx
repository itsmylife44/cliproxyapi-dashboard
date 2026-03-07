"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface CreatedKey {
  id: string;
  key: string;
  name: string;
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <div
      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400"
      aria-hidden="true"
    />
  );
}

export function Step1Content({ done }: { done: boolean }) {
  if (done) return null;
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-slate-400">
        Open the Providers page in a new tab to add your first provider. This
        wizard will automatically detect when a provider is connected.
      </p>
      <a
        href="/dashboard/providers"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-md border glass-button-primary text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
      >
        Open Providers
      </a>
    </div>
  );
}

interface Step2ContentProps {
  done: boolean;
  locked: boolean;
  onCreated: (key: CreatedKey) => void;
}

export function Step2Content({ done, locked, onCreated }: Step2ContentProps) {
  const { showToast } = useToast();
  const [keyName, setKeyName] = useState("default");
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCreate = useCallback(async () => {
    const trimmed = keyName.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await fetch(API_ENDPOINTS.USER.API_KEYS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        showToast(body.error ?? "Failed to create API key", "error");
        return;
      }
      const body = (await res.json()) as {
        id: string;
        key: string;
        name: string;
        createdAt: string;
        syncStatus: string;
        syncMessage?: string;
      };
      const created: CreatedKey = { id: body.id, key: body.key, name: body.name };
      setCreatedKey(created);
      onCreated(created);
      showToast("API key created successfully", "success");
    } catch {
      showToast("Network error -- please try again", "error");
    } finally {
      setSubmitting(false);
    }
  }, [keyName, onCreated, showToast]);

  const handleCopy = useCallback(() => {
    if (!createdKey) return;
    void navigator.clipboard.writeText(createdKey.key).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [createdKey]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  if (done && !createdKey) return null;

  if (locked) {
    return (
      <div className="mt-3 rounded-md border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs text-slate-500">
        Complete Step 1 first to unlock this step.
      </div>
    );
  }

  if (createdKey) {
    return (
      <div className="mt-3 space-y-2">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Copy your API key now -- it will not be shown again.
        </div>
        <div className="flex items-center gap-2 rounded-md border border-slate-700/70 bg-slate-900/60 px-3 py-2">
          <code className="flex-1 truncate font-mono text-xs text-slate-200">
            {createdKey.key}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-shrink-0 items-center gap-1 rounded border border-slate-600/60 bg-slate-800/70 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700/80 hover:text-slate-100"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Key name: <span className="text-slate-300">{createdKey.name}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            name="api-key-name"
            value={keyName}
            onChange={setKeyName}
            placeholder="My API Key"
            disabled={submitting}
          />
        </div>
        <Button
          variant="primary"
          className="flex-shrink-0 text-xs"
          disabled={submitting || !keyName.trim()}
          onClick={() => void handleCreate()}
        >
          {submitting ? "Creating..." : "Create API Key"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Give your key a memorable name, then click Create.
      </p>
    </div>
  );
}

interface Step3ContentProps {
  done: boolean;
  locked: boolean;
  modelCount: number;
  statusLoaded: boolean;
}

export function Step3Content({ done, locked, modelCount, statusLoaded }: Step3ContentProps) {
  if (done) return null;

  if (locked) {
    return (
      <div className="mt-3 rounded-md border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs text-slate-500">
        Complete the previous steps first to unlock this step.
      </div>
    );
  }

  if (!statusLoaded) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        <SpinnerIcon />
        Checking model catalog...
      </div>
    );
  }

  if (modelCount === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        <SpinnerIcon />
        Waiting for models to become available...
      </div>
    );
  }

  return null;
}
