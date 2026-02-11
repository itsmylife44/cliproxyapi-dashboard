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
        "px-4 py-1.5 text-sm font-medium tracking-wide transition-all duration-200 rounded-lg",
        "border disabled:opacity-50 disabled:cursor-not-allowed",
        "hover:scale-[1.02] active:scale-[0.98]",
        variant === "primary" && "bg-purple-600 text-white border-purple-500 hover:bg-purple-500 shadow-lg shadow-purple-600/20",
        variant === "secondary" && "glass-button-secondary text-white",
        variant === "danger" && "bg-red-600/80 text-white border-red-500/60 hover:bg-red-500/80 shadow-lg shadow-red-600/20",
        variant === "ghost" && "glass-button-ghost text-white/80 hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}
