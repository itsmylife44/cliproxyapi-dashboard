"use client";

import { parseStatusMessage, STATUS_MESSAGE_MAX_LENGTH } from "./oauth-types";

interface OAuthStatusBadgeProps {
  status: string;
  statusMessage: string | null;
  unavailable: boolean;
}

export function OAuthStatusBadge({ status, statusMessage, unavailable }: OAuthStatusBadgeProps) {
  const message = parseStatusMessage(statusMessage);

  if (status === "active" && !unavailable) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400" title="Token is valid and working">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }

  if (status === "error" || unavailable) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400"
        title={message || "Account has an error"}
      >
        <span className="size-1.5 rounded-full bg-red-400" />
        {message
          ? message.length > STATUS_MESSAGE_MAX_LENGTH ? `${message.slice(0, STATUS_MESSAGE_MAX_LENGTH)}…` : message
          : "Error"}
      </span>
    );
  }

  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-400" title="Account is disabled">
        <span className="size-1.5 rounded-full bg-slate-400" />
        Disabled
      </span>
    );
  }

  return null;
}
