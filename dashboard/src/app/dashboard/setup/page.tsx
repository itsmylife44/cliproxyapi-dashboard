"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("setupWizard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreatedKey, setJustCreatedKey] = useState<CreatedKey | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.SETUP.STATUS);
      if (!res.ok) {
        let message = t("errorLoadStatus");
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch { /* non-JSON error response */ }
        setError(message);
        return;
      }
      const data = (await res.json()) as SetupStatus;
      setStatus(data);
      setError(null);
    } catch {
      setError(t("errorNetworkRetrying"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const step1Done = status ? status.providers > 0 : false;
  const step2Done = status ? status.apiKeys > 0 : false;
  const step3Done = status ? status.models > 0 : false;

  const stepDone = [step1Done, step2Done, step3Done];
  const completedCount = stepDone.filter(Boolean).length;
  const allDone = completedCount === 3;
  const firstIncomplete = stepDone.findIndex((d) => !d);

  useEffect(() => {
    void fetchStatus();
    if (allDone) return;
    const interval = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, allDone]);

  const STEPS = [
    { id: 1, title: t("stepTitle1"), doneLabel: t("stepDone1") },
    { id: 2, title: t("stepTitle2"), doneLabel: t("stepDone2") },
    { id: 3, title: t("stepTitle3"), doneLabel: t("stepDone3") },
  ];

  const stepDescriptions = [
    t("stepDesc1"),
    t("stepDesc2"),
    t("stepDesc3"),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t("subtitle")}
            </p>
          </div>
          {status && (
            <div className="flex-shrink-0 rounded-md border border-[var(--surface-border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              {completedCount}&nbsp;/&nbsp;{STEPS.length}
            </div>
          )}
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-[width] duration-700"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </section>

      {error && !loading && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <Card>
        {loading && !status ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--surface-border)] border-t-blue-400" />
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
                        ? "bg-emerald-500/10"
                        : active
                          ? "bg-blue-500/10 ring-1 ring-blue-200"
                          : "opacity-60",
                    ].join(" ")}
                  >
                    <div className="flex flex-col items-center">
                      <StepIndicator step={step.id} done={done} active={active} />
                      {!isLast && (
                        <div
                          className={[
                            "mt-2 w-px flex-1",
                            done ? "bg-emerald-500/30" : "bg-[var(--surface-muted)]",
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
                              ? "text-emerald-700"
                              : active
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-muted)]",
                          ].join(" ")}
                        >
                          {step.title}
                        </h2>
                        {done && (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                            {step.doneLabel}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                        {stepDescriptions[index]}
                      </p>

                      {index === 0 && (
                        <Step1Content done={done} />
                      )}

                      {index === 1 && (
                        <Step2Content
                          done={done}
                          locked={!step1Done && !step2Done}
                          onCreated={setJustCreatedKey}
                        />
                      )}

                      {index === 2 && (
                        <Step3Content
                          done={done}
                          locked={!step2Done && !step3Done}
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
                    <div className="mx-4 border-b border-[var(--surface-border)]/40" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {allDone && <SuccessBanner />}

      {!allDone && (
        <p className="text-center text-xs text-[var(--text-muted)]">
          {t("autoRefreshNote")}
        </p>
      )}
    </div>
  );
}
