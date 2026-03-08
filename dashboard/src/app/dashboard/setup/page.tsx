"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/setup/step-indicator";
import { Step1Content, Step2Content, Step3Content } from "@/components/setup/step-contents";
import { SuccessBanner } from "@/components/setup/success-banner";
import { RevealBox } from "@/components/setup/reveal-box";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

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

export default function SetupWizardPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreatedKey, setJustCreatedKey] = useState<CreatedKey | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.SETUP.STATUS);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load setup status");
        return;
      }
      const data = (await res.json()) as SetupStatus;
      setStatus(data);
      setError(null);
    } catch {
      setError("Network error -- retrying...");
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

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </section>

      {error && !loading && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

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

                    <div className="flex-1 pb-2">
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

                      <p className="mt-1 text-sm leading-relaxed text-slate-400">
                        {stepDescriptions[index]}
                      </p>

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

      {allDone && <SuccessBanner />}

      {!allDone && (
        <p className="text-center text-xs text-slate-600">
          This page auto-refreshes every 5 seconds. Complete steps in any tab
          and they will appear here automatically.
        </p>
      )}
    </div>
  );
}
