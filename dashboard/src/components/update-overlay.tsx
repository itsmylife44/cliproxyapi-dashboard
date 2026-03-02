"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface UpdateOverlayProps {
  isVisible: boolean;
  targetVersion: string;
  variant: "dashboard" | "proxy";
}

const STEPS = [
  { label: "Pulling new version", duration: 3000 },
  { label: "Installing update", duration: 5000 },
  { label: "Restarting container", duration: 4000 },
  { label: "Waiting for server", duration: 0 },
] as const;

export function UpdateOverlay({
  isVisible,
  targetVersion,
  variant,
}: UpdateOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [serverReady, setServerReady] = useState(false);
  const [dots, setDots] = useState("");

  const isDashboard = variant === "dashboard";
  const label = isDashboard ? "Dashboard" : "CLIProxyAPI";

  // Reset state when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      setCurrentStep(0);
      setServerReady(false);
      setDots("");
    }
  }, [isVisible]);

  // Progress through steps with timers
  useEffect(() => {
    if (!isVisible) return;
    if (currentStep >= STEPS.length - 1) return;

    const step = STEPS[currentStep];
    if (step.duration === 0) return;

    const timer = setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, step.duration);

    return () => clearTimeout(timer);
  }, [isVisible, currentStep]);

  // Animated dots for current step
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Poll server availability once we reach the last step
  useEffect(() => {
    if (!isVisible || currentStep < STEPS.length - 1) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    const poll = async () => {
      // Wait a bit before first poll to give the container time to stop
      await new Promise((resolve) => setTimeout(resolve, 5000));

      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        try {
          const res = await fetch("/api/health", {
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            if (!cancelled) {
              setServerReady(true);
            }
            return;
          }
        } catch {
          // Server not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [isVisible, currentStep]);

  // Auto-reload after showing success briefly
  useEffect(() => {
    if (!serverReady) return;

    const timer = setTimeout(() => {
      window.location.reload();
    }, 1500);

    return () => clearTimeout(timer);
  }, [serverReady]);

  if (!isVisible) return null;

  const progress = serverReady
    ? 100
    : Math.min(((currentStep + 1) / STEPS.length) * 90, 90);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-modal-overlay" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 animate-modal-card">
        {/* Animated spinner ring */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Outer ring (static) */}
          <div
            className={cn(
              "h-24 w-24 rounded-full border-4",
              isDashboard ? "border-purple-500/20" : "border-blue-500/20"
            )}
          />
          {/* Spinning ring */}
          <div
            className={cn(
              "absolute h-24 w-24 rounded-full border-4 border-transparent animate-spin",
              isDashboard ? "border-t-purple-400" : "border-t-blue-400"
            )}
            style={{ animationDuration: "1.2s" }}
          />
          {/* Inner pulse */}
          <div
            className={cn(
              "absolute h-16 w-16 rounded-full animate-pulse",
              isDashboard ? "bg-purple-500/10" : "bg-blue-500/10"
            )}
          />
          {/* Center icon */}
          <div className="absolute flex items-center justify-center">
            {serverReady ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <title>Complete</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                  "h-8 w-8",
                  isDashboard ? "text-purple-400" : "text-blue-400"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <title>Updating</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-1">
            {serverReady ? "Update Complete!" : `Updating ${label}`}
          </h2>
          <p className="text-sm text-white/50 font-mono">{targetVersion}</p>
        </div>

        {/* Progress bar */}
        <div className="w-72">
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                serverReady
                  ? "bg-green-400"
                  : isDashboard
                    ? "bg-gradient-to-r from-purple-500 to-purple-400"
                    : "bg-gradient-to-r from-blue-500 to-blue-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2 w-72">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStep && !serverReady;
            const isComplete = idx < currentStep || serverReady;

            return (
              <div key={step.label} className="flex items-center gap-3">
                {/* Step indicator */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isComplete ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <title>Done</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isActive ? (
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full animate-pulse",
                        isDashboard ? "bg-purple-400" : "bg-blue-400"
                      )}
                    />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-white/20" />
                  )}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    "text-sm",
                    isComplete && "text-white/60",
                    isActive && "text-white font-medium",
                    !isComplete && !isActive && "text-white/30"
                  )}
                >
                  {step.label}
                  {isActive ? dots : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <p className="text-xs text-white/30 text-center">
          {serverReady ? "Reloading page..." : "Please don't close this page"}
        </p>
      </div>
    </div>
  );
}
