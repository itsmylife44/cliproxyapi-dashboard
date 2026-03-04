"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetupStatus {
  providers: number;
  apiKeys: number;
  models: number;
}

interface CreatedKey {
  id: string;
  key: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Small shared icons
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
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

// ---------------------------------------------------------------------------
// Step indicator (unchanged from original)
// ---------------------------------------------------------------------------

function StepNumber({ n }: { n: number }) {
  return (
    <span className="text-sm font-semibold leading-none" aria-hidden="true">
      {n}
    </span>
  );
}

function StepIndicator({
  step,
  done,
  active,
}: {
  step: number;
  done: boolean;
  active: boolean;
}) {
  if (done) {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
        <CheckIcon />
      </div>
    );
  }
  if (active) {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.25)]">
        <StepNumber n={step} />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-800/60 text-slate-500 ring-1 ring-slate-700/60">
      <StepNumber n={step} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success banner (unchanged from original)
// ---------------------------------------------------------------------------

function SuccessBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 shadow-[0_0_32px_rgba(16,185,129,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/40">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-emerald-300">
            All steps complete
          </p>
          <p className="mt-0.5 text-sm text-slate-400">
            Your CLIProxyAPI instance is fully configured and ready to use.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="primary" className="flex-shrink-0 whitespace-nowrap">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 content — provider link (opens in new tab)
// ---------------------------------------------------------------------------

function Step1Content({ done }: { done: boolean }) {
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
      >
        <Button variant="primary" className="text-xs">
          Open Providers
        </Button>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 content — inline API key creation form
// ---------------------------------------------------------------------------

interface Step2ContentProps {
  done: boolean;
  locked: boolean;
  onCreated: (key: CreatedKey) => void;
}

function Step2Content({ done, locked, onCreated }: Step2ContentProps) {
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
      const res = await fetch("/api/user/api-keys", {
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
      showToast("Network error — please try again", "error");
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

  // Already done from a previous session — no form needed, step is complete
  if (done && !createdKey) return null;

  // Previous step not complete — show locked message
  if (locked) {
    return (
      <div className="mt-3 rounded-md border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs text-slate-500">
        Complete Step 1 first to unlock this step.
      </div>
    );
  }

  // Key was just created — show the reveal box
  if (createdKey) {
    return (
      <div className="mt-3 space-y-2">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Copy your API key now — it will not be shown again.
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

  // Form
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

// ---------------------------------------------------------------------------
// Step 3 content — auto-verified, no form
// ---------------------------------------------------------------------------

function Step3Content({
  done,
  locked,
  modelCount,
  statusLoaded,
}: {
  done: boolean;
  locked: boolean;
  modelCount: number;
  statusLoaded: boolean;
}) {
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SetupWizardPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track a key created in this session so we can keep showing the reveal box
  // even after the status polling marks step 2 as done.
  const [justCreatedKey, setJustCreatedKey] = useState<CreatedKey | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/setup-status");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load setup status");
        return;
      }
      const data = (await res.json()) as SetupStatus;
      setStatus(data);
      setError(null);
    } catch {
      setError("Network error — retrying...");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const step1Done = status ? status.providers > 0 : false;
  const step2Done = status ? status.apiKeys > 0 : false;
  const step3Done = status ? status.models > 0 : false;

  const stepDone = [step1Done, step2Done, step3Done];
  const completedCount = stepDone.filter(Boolean).length;
  const allDone = completedCount === 3;

  const firstIncomplete = stepDone.findIndex((d) => !d);

  // Step metadata (title + doneLabel only — content is rendered per-step below)
  const STEPS = [
    { id: 1, title: "Connect a Provider", doneLabel: "Provider connected" },
    { id: 2, title: "Create an API Key", doneLabel: "API key created" },
    { id: 3, title: "Verify Model Catalog", doneLabel: "Models available" },
  ] as const;

  const stepDescriptions = [
    "Add an OAuth account or configure an API key provider. Providers are the AI services that power your proxy (Claude, Gemini, Codex, and more).",
    "Generate a personal API key. This key is what your clients (Claude Code, Gemini CLI, etc.) use to authenticate with the proxy.",
    "Once a provider and API key are set up, the proxy exposes models automatically. This step confirms the catalog is populated and the proxy is reachable.",
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              Setup Wizard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Complete these steps to get CLIProxyAPI up and running.
            </p>
          </div>
          {status && (
            <div className="flex-shrink-0 rounded-md border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-300">
              {completedCount}&nbsp;/&nbsp;{STEPS.length}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </section>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Steps */}
      <Card>
        {loading && !status ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
          </div>
        ) : (
          <div className="space-y-1">
            {STEPS.map((step, index) => {
              const done = stepDone[index] ?? false;
              const active = !done && index === firstIncomplete;
              const isLast = index === STEPS.length - 1;

              return (
                <div key={step.id}>
                  <div
                    className={[
                      "flex gap-4 rounded-lg p-4 transition-colors",
                      done
                        ? "bg-emerald-500/5"
                        : active
                          ? "bg-blue-500/5 ring-1 ring-blue-500/20"
                          : "opacity-60",
                    ].join(" ")}
                  >
                    {/* Left: indicator + connector */}
                    <div className="flex flex-col items-center">
                      <StepIndicator step={step.id} done={done} active={active} />
                      {!isLast && (
                        <div
                          className={[
                            "mt-2 w-px flex-1",
                            done ? "bg-emerald-500/30" : "bg-slate-700/60",
                          ].join(" ")}
                          style={{ minHeight: "1.5rem" }}
                        />
                      )}
                    </div>

                    {/* Right: content */}
                    <div className="flex-1 pb-2">
                      {/* Title row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2
                          className={[
                            "text-sm font-semibold",
                            done
                              ? "text-emerald-300"
                              : active
                                ? "text-slate-100"
                                : "text-slate-400",
                          ].join(" ")}
                        >
                          {step.title}
                        </h2>
                        {done && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                            {step.doneLabel}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">
                        {stepDescriptions[index]}
                      </p>

                      {/* Per-step inline content */}
                      {index === 0 && (
                        <Step1Content done={done} />
                      )}

                      {index === 1 && (
                        <Step2Content
                          done={done}
                          locked={!step1Done}
                          onCreated={setJustCreatedKey}
                        />
                      )}

                      {index === 2 && (
                        <Step3Content
                          done={done}
                          locked={!step2Done}
                          modelCount={status?.models ?? 0}
                          statusLoaded={status !== null}
                        />
                      )}

                      {/* Keep the created-key reveal box visible even after step
                          is marked done (so the user can still copy the key). */}
                      {index === 1 && done && justCreatedKey && (
                        <RevealBox createdKey={justCreatedKey} />
                      )}
                    </div>
                  </div>

                  {!isLast && (
                    <div className="mx-4 border-b border-slate-700/40" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Success banner */}
      {allDone && <SuccessBanner />}

      {/* Footer hint */}
      {!allDone && (
        <p className="text-center text-xs text-slate-600">
          This page auto-refreshes every 5 seconds. Complete steps in any tab
          and they will appear here automatically.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RevealBox — shown after step 2 is polled as done, to keep the copy UI
// ---------------------------------------------------------------------------

function RevealBox({ createdKey }: { createdKey: CreatedKey }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(createdKey.key).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [createdKey.key]);

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        Copy your API key now — it will not be shown again after you leave this
        page.
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
    </div>
  );
}
