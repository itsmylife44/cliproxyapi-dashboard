"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning"
}: ConfirmDialogProps) {
  const previousOverflowRef = useRef<string>("");

  useEffect(() => {
    if (isOpen) {
      previousOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflowRef.current;
    }

    return () => {
      document.body.style.overflow = previousOverflowRef.current;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleBackdropClick = () => {
    onClose();
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="animate-modal-overlay fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      tabIndex={-1}
    >
      <div
        className="animate-modal-card relative w-full max-w-md bg-slate-900 border border-slate-700/70 rounded-xl p-6 shadow-2xl"
        onClick={handleContentClick}
        onKeyDown={handleContentKeyDown}
        role="document"
      >
        <div className="flex items-center justify-center mb-4">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              variant === "danger" && "bg-red-500/20 text-red-400",
              variant === "warning" && "bg-yellow-500/20 text-yellow-400",
              variant === "info" && "bg-blue-500/20 text-blue-400"
            )}
          >
            {variant === "danger" && (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {variant === "warning" && (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {variant === "info" && (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </div>

        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-white text-center mb-3"
        >
          {title}
        </h2>

        <div
          id="confirm-dialog-message"
          className="text-sm text-white/80 text-center mb-6"
        >
          {message}
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {cancelLabel}
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200",
              "focus:outline-none focus:ring-2",
              variant === "danger" && "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500/50",
              variant === "warning" && "bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500/50",
              variant === "info" && "bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500/50"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
