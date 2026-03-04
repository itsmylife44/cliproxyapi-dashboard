"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface TooltipProps {
  children: ReactNode;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  children,
  content,
  side = "top",
  className,
}: TooltipProps) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 max-w-xs",
          "bg-slate-800 border border-slate-600/50 text-slate-200 text-xs rounded-md px-2 py-1 shadow-lg",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-150",
          "whitespace-normal break-words",
          // Positioning per side
          side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
          side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-1.5",
          side === "left" && "right-full top-1/2 -translate-y-1/2 mr-1.5",
          side === "right" && "left-full top-1/2 -translate-y-1/2 ml-1.5",
          className
        )}
      >
        {content}
        {/* Arrow/caret */}
        <span
          className={cn(
            "pointer-events-none absolute",
            "border-4 border-transparent",
            side === "top" &&
              "top-full left-1/2 -translate-x-1/2 border-t-slate-800",
            side === "bottom" &&
              "bottom-full left-1/2 -translate-x-1/2 border-b-slate-800",
            side === "left" &&
              "left-full top-1/2 -translate-y-1/2 border-l-slate-800",
            side === "right" &&
              "right-full top-1/2 -translate-y-1/2 border-r-slate-800"
          )}
        />
      </span>
    </span>
  );
}

interface HelpTooltipProps {
  content: string;
}

export function HelpTooltip({ content }: HelpTooltipProps) {
  return (
    <Tooltip content={content}>
      <span
        className="inline-flex items-center justify-center size-4 rounded-full bg-slate-700/50 text-slate-400 text-[10px] cursor-help hover:bg-slate-600/50 transition-colors duration-150 select-none"
        aria-label={content}
      >
        ?
      </span>
    </Tooltip>
  );
}
