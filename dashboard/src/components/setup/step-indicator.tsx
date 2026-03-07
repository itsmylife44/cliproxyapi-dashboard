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
