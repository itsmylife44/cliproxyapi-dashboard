import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className,
  "data-testid": dataTestId,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
      className={cn(
        "px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 rounded-full",
        "border disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "glass-button-primary text-white",
        variant === "secondary" && "glass-button-secondary text-[var(--text-primary)]",
        variant === "danger" && "bg-red-500/100 text-white border-none hover:bg-red-600",
        variant === "ghost" && "glass-button-ghost text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        className
      )}
    >
      {children}
    </button>
  );
}
