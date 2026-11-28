"use client";

import { useTranslations } from "next-intl";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";

interface AutoPrimeHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

/** A short notice: what Auto-prime does, the timeline that shows it, and its cost. */
export function AutoPrimeHelp({ isOpen, onClose }: AutoPrimeHelpProps) {
  const t = useTranslations("quota");

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader className="mb-3 pb-2">
        <ModalTitle>{t("autoPrimeToggle")}</ModalTitle>
      </ModalHeader>
      <ModalContent className="mb-0 space-y-3 text-sm">
        <p className="text-[var(--text-secondary)]">{t("autoPrimeWhat")}</p>
        <PrimeTimeline />
        <p className="text-xs text-[var(--text-muted)]">{t("autoPrimeNote")}</p>
      </ModalContent>
    </Modal>
  );
}

/** Share of the timeline the account sits idle before its first prompt when Auto-prime is off. */
const IDLE_SHARE = 40;
const WINDOW_SHARE = 100 - IDLE_SHARE;

/**
 * Two lanes read left to right from the same refill: a prompt marker shows when the countdown starts,
 * and the bar shows the countdown up to the next refill. HTML so every label wraps at any width.
 */
function PrimeTimeline() {
  const t = useTranslations("quota.autoPrimeDiagram");
  const nextRefill = t("nextRefill");

  return (
    <figure className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 p-3 text-xs">
      <div className="space-y-2.5 border-l border-dashed border-[var(--text-muted)] pl-2">
        <p className="text-[var(--text-muted)]">{t("refill")}</p>
        <TimelineLane title={t("without")} promptDelayed prompt={t("firstPrompt")} gapLabel={t("idle")} nextRefill={nextRefill} />
        <TimelineLane title={t("with")} promptDelayed={false} prompt={t("primePrompt")} gapLabel={t("sooner")} nextRefill={nextRefill} />
      </div>
    </figure>
  );
}

interface TimelineLaneProps {
  title: string;
  /** Off: the first prompt comes after an idle gap. On: the prompt lands on the refill and the gap is time saved. */
  promptDelayed: boolean;
  prompt: string;
  gapLabel: string;
  nextRefill: string;
}

function TimelineLane({ title, promptDelayed, prompt, gapLabel, nextRefill }: TimelineLaneProps) {
  const gapWidth = { width: `${IDLE_SHARE}%` };
  const countdownWidth = { width: `${WINDOW_SHARE}%` };
  const gap = (
    <p
      className={`min-w-0 shrink-0 px-1 text-center break-words ${promptDelayed ? "text-[var(--text-muted)]" : "font-medium text-[var(--accent)]"}`}
      style={gapWidth}
    >
      {gapLabel}
    </p>
  );

  return (
    <div>
      <p className="mb-1 font-medium text-[var(--text-primary)]">{title}</p>
      <div className="flex">
        {promptDelayed && <div className="shrink-0" style={gapWidth} />}
        <p className="min-w-0 border-l-2 border-[var(--accent)] pb-1 pl-1 break-words text-[var(--accent)]" style={countdownWidth}>{prompt}</p>
      </div>
      <div className="flex h-2.5 items-center">
        {promptDelayed && <div className="shrink-0 border-t-2 border-dotted border-[var(--text-muted)]" style={gapWidth} />}
        <div className="h-full rounded-r-sm border-l-2 border-[var(--accent)] bg-[var(--text-primary)]/80" style={countdownWidth} />
        {!promptDelayed && <div className="h-full shrink-0 rounded-sm border border-dashed border-[var(--accent)]" style={gapWidth} />}
      </div>
      <div className="mt-1 flex">
        {promptDelayed && gap}
        <p className="min-w-0 pr-1 text-right break-words text-[var(--text-secondary)]" style={countdownWidth}>{nextRefill}</p>
        {!promptDelayed && gap}
      </div>
    </div>
  );
}
