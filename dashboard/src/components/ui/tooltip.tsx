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
  content: _content,
  side = "top",
  className,
}: TooltipProps) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-52",
          "bg-white text-[#4e4e4e] text-[10px] leading-[14px] rounded-md px-2.5 py-1.5 shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_8px]",
          "transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          "whitespace-normal break-words",
          side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
          side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-1.5",
          side === "left" && "right-full top-1/2 -translate-y-1/2 mr-1.5",
          side === "right" && "left-full top-1/2 -translate-y-1/2 ml-1.5",
          className
        )}
      >
        {_content}
        <span
          className={cn(
            "pointer-events-none absolute",
            "border-4 border-transparent",
            side === "top" &&
              "top-full left-1/2 -translate-x-1/2 border-t-white",
            side === "bottom" &&
              "bottom-full left-1/2 -translate-x-1/2 border-b-white",
            side === "left" &&
              "left-full top-1/2 -translate-y-1/2 border-l-white",
            side === "right" &&
              "right-full top-1/2 -translate-y-1/2 border-r-white"
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
      <button
        type="button"
        className="inline-flex items-center justify-center size-5 rounded-full bg-[#f5f5f5] text-[#777169] text-[9px] cursor-help hover:bg-[#e5e5e5] hover:text-[#4e4e4e] transition-colors duration-150 select-none ml-1 align-middle"
        aria-label={content}
      >
        ?
      </button>
    </Tooltip>
  );
}
