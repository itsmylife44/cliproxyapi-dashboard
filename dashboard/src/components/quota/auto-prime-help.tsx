"use client";

import { useTranslations } from "next-intl";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";

interface AutoPrimeHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const DETAIL_SECTIONS = ["why", "what", "quiet", "cost"] as const;

/** Explains how starting the limit countdown moves the next refill earlier. */
export function AutoPrimeHelp({ isOpen, onClose }: AutoPrimeHelpProps) {
  const t = useTranslations("quota");

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <ModalHeader>
        <ModalTitle>{t("autoPrimeToggle")}</ModalTitle>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("autoPrimeSummary")}</p>
      </ModalHeader>
      <ModalContent className="space-y-5">
        <PrimeTimeline />
        <dl className="space-y-3 text-sm">
          {DETAIL_SECTIONS.map((section) => (
            <div key={section}>
              <dt className="font-medium text-[var(--text-primary)]">{t(`autoPrimeDetails.${section}.title`)}</dt>
              <dd className="mt-0.5 leading-relaxed text-[var(--text-secondary)]">{t(`autoPrimeDetails.${section}.body`)}</dd>
            </div>
          ))}
        </dl>
      </ModalContent>
    </Modal>
  );
}

/** Two lanes on one time axis: the same refill, used later vs. started immediately. */
function PrimeTimeline() {
  const t = useTranslations("quota.autoPrimeDiagram");
  const refillX = 24;
  const idleEndX = 132;
  const windowWidth = 156;
  const lanes = [
    { label: t("without"), start: idleEndX, y: 30 },
    { label: t("with"), start: refillX, y: 74 },
  ];

  return (
    <figure className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-muted)]/35 p-3">
      <svg viewBox="0 0 320 104" className="w-full text-[var(--text-primary)]" role="img" aria-label={t("caption")}>
        <line x1={refillX} y1="8" x2={refillX} y2="96" stroke="var(--text-muted)" strokeDasharray="2 3" />
        <text x={refillX + 4} y="12" fontSize="9" fill="var(--text-muted)">{t("refill")}</text>
        {lanes.map(({ label, start, y }) => (
          <g key={label}>
            <text x={refillX} y={y - 8} fontSize="10" fontWeight="500" fill="currentColor">{label}</text>
            {start > refillX && (
              <line x1={refillX} y1={y + 5} x2={start} y2={y + 5} stroke="var(--text-muted)" strokeDasharray="1 3" strokeLinecap="round" />
            )}
            <rect x={start} y={y} width={windowWidth} height="10" rx="3" fill="currentColor" opacity="0.85" />
            <line x1={start + windowWidth} y1={y - 4} x2={start + windowWidth} y2={y + 14} stroke="currentColor" strokeWidth="1.5" />
            <text x={start + windowWidth + 4} y={y + 9} fontSize="9" fill="var(--text-secondary)">{t("nextRefill")}</text>
          </g>
        ))}
        <text x={(refillX + idleEndX) / 2} y="52" fontSize="9" textAnchor="middle" fill="var(--text-muted)">{t("idle")}</text>
      </svg>
      <figcaption className="mt-1 text-xs text-[var(--text-muted)]">{t("caption")}</figcaption>
    </figure>
  );
}
