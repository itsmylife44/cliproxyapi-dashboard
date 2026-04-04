"use client";

import dynamic from "next/dynamic";

const UpdateNotification = dynamic(
  () => import("@/components/update-notification").then(mod => ({ default: mod.UpdateNotification })),
  { ssr: false }
);

export function LazyUpdateNotification() {
  return <UpdateNotification />;
}
