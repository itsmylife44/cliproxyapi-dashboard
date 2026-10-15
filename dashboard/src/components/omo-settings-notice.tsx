"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { addDismissedId, getDismissedIds } from "@/lib/notification-dismissal";

const NOTICE_ID = "omo-settings-not-applied-4.19.3";
const noopSubscribe = () => () => {};

export function OmoSettingsNotice({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  // Server snapshot = dismissed, so the banner never flashes before localStorage is read.
  const storedDismissed = useSyncExternalStore(
    noopSubscribe,
    () => getDismissedIds(userId).has(NOTICE_ID),
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);

  if (storedDismissed || dismissed) return null;

  const dismiss = () => {
    addDismissedId(userId, NOTICE_ID);
    setDismissed(true);
  };

  return (
    <section className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div>
        <p className="text-sm font-semibold text-amber-700">{t("omoNoticeTitle")}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("omoNoticeBody")}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tCommon("dismiss")}
        title={tCommon("dismiss")}
        className="shrink-0 rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-500/20"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </section>
  );
}
