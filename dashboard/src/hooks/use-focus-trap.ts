import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function useFocusTrap(
  isOpen: boolean,
  containerRef?: React.RefObject<HTMLElement | null>,
) {
  const internalRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  const resolvedRef = containerRef ?? internalRef;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const container = resolvedRef.current;
      if (!container) {
        return;
      }

      const focusableElements = getFocusableElements(container);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (
          document.activeElement === firstElement ||
          document.activeElement === container
        ) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (
          document.activeElement === lastElement ||
          document.activeElement === container
        ) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [resolvedRef],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement;

    const container = resolvedRef.current;
    if (container) {
      if (!container.getAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      container.focus();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [isOpen, resolvedRef, handleKeyDown]);

  return internalRef;
}
