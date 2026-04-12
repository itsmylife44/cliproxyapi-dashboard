"use client";

import { cn } from "@/lib/utils";
import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  showToast: (message: string, type: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => { clearTimeout(timer); });
      timers.clear();
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      removeToast(id);
    }, 5000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pl-5 pr-2 py-3 text-sm font-medium rounded-xl",
              "animate-in slide-in-from-right-5 transition-[opacity,transform,border-color] duration-300",
              "flex items-center gap-3",
              toast.type === "success" && "bg-[var(--surface-base)] border-l-4 border-l-emerald-500 border border-[var(--surface-border)] text-[var(--text-primary)] shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_4px]",
              toast.type === "error" && "bg-[var(--surface-base)] border-l-4 border-l-red-500 border border-[var(--surface-border)] text-[var(--text-primary)] shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_4px]",
              toast.type === "info" && "bg-[var(--surface-base)] border-l-4 border-l-blue-500 border border-[var(--surface-border)] text-[var(--text-primary)] shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_4px]"
            )}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded-md p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
