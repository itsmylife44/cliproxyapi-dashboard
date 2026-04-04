"use client";

import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

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
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onTouchStart={() => setVisible((v) => !v)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-52",
          "bg-slate-900/95 backdrop-blur-sm border border-slate-600/40 text-slate-300 text-[10px] leading-[14px] rounded-md px-2.5 py-1.5 shadow-xl",
          "transition-opacity duration-150",
          "whitespace-normal break-words",
          visible ? "opacity-100" : "opacity-0",
          side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
          side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-1.5",
          side === "left" && "right-full top-1/2 -translate-y-1/2 mr-1.5",
          side === "right" && "left-full top-1/2 -translate-y-1/2 ml-1.5",
          className
        )}
      >
        {content}
        <span
          className={cn(
            "pointer-events-none absolute",
            "border-4 border-transparent",
            side === "top" &&
              "top-full left-1/2 -translate-x-1/2 border-t-slate-900/95",
            side === "bottom" &&
              "bottom-full left-1/2 -translate-x-1/2 border-b-slate-900/95",
            side === "left" &&
              "left-full top-1/2 -translate-y-1/2 border-l-slate-900/95",
            side === "right" &&
              "right-full top-1/2 -translate-y-1/2 border-r-slate-900/95"
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
    <Tooltip content={content} side="bottom">
      <span
        className="inline-flex items-center justify-center size-5 min-w-[44px] min-h-[44px] rounded-full bg-slate-700/40 text-slate-500 text-[9px] cursor-help hover:bg-slate-600/50 hover:text-slate-400 transition-colors duration-150 select-none ml-1 align-middle"
        tabIndex={0}
        aria-label={content}
      >
        ?
      </span>
    </Tooltip>
  );
}
