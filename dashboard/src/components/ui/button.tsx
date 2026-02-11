import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-md",
        "border disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "glass-button-primary text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]",
        variant === "secondary" && "glass-button-secondary text-slate-100",
        variant === "danger" && "bg-rose-700/80 text-white border-rose-500/60 hover:bg-rose-600/80",
        variant === "ghost" && "glass-button-ghost text-slate-300 hover:text-slate-100",
        className
      )}
    >
      {children}
    </button>
  );
}
