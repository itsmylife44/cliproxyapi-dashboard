"use client";

import { cn } from "@/lib/utils";
import { createContext, useContext, type ReactNode, useEffect, useId, useRef } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useTranslations } from "next-intl";

const ModalTitleIdContext = createContext<string>("");

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, children, className }: ModalProps) {
  const t = useTranslations('common');
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(isOpen, modalRef as React.RefObject<HTMLElement | null>);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalTitleIdContext.Provider value={titleId}>
      <div
        className="animate-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="absolute inset-0"
          onClick={onClose}
          aria-label={t('closeModal')}
        />
        <div
          ref={modalRef}
          className={cn(
            "animate-modal-card relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-[var(--surface-base)] border-none rounded-2xl p-5 shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_8px,rgba(78,50,23,0.04)_0px_6px_16px]",
            className
          )}
          style={{ overscrollBehavior: "contain" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </ModalTitleIdContext.Provider>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn("mb-4 border-b border-[var(--surface-border)] pb-3", className)}>
      {children}
    </div>
  );
}

interface ModalTitleProps {
  children: ReactNode;
  className?: string;
}

export function ModalTitle({ children, className }: ModalTitleProps) {
  const titleId = useContext(ModalTitleIdContext);
  return (
    <h2 id={titleId} className={cn("text-lg font-medium tracking-tight text-[var(--text-primary)]", className)}>
      {children}
    </h2>
  );
}

interface ModalContentProps {
  children: ReactNode;
  className?: string;
}

export function ModalContent({ children, className }: ModalContentProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn("flex justify-end gap-4 border-t border-[var(--surface-border)] pt-4", className)}>
      {children}
    </div>
  );
}
