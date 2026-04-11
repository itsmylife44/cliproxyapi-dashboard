"use client";

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

function StepNumber({ n }: { n: number }) {
  return (
    <span className="text-sm font-semibold leading-none" aria-hidden="true">
      {n}
    </span>
  );
}

interface StepIndicatorProps {
  step: number;
  done: boolean;
  active: boolean;
}

export function StepIndicator({ step, done, active }: StepIndicatorProps) {
  if (done) {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/40">
        <CheckIcon />
      </div>
    );
  }
  if (active) {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 ring-1 ring-blue-200 shadow-sm">
        <StepNumber n={step} />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)] ring-1 ring-[var(--surface-border)]">
      <StepNumber n={step} />
    </div>
  );
}
