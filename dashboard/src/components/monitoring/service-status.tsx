"use client";

import { Button } from "@/components/ui/button";

interface StatusResponse {
  running: boolean;
  containerName?: string;
  uptime?: number;
  error?: string;
}

interface ServiceStatusProps {
  status: StatusResponse | null;
  restarting: boolean;
  onConfirmRestart: () => void;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export function ServiceStatus({ status, restarting, onConfirmRestart }: ServiceStatusProps) {
  return (
    <section className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Service Status</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/90">CLIProxyAPI</span>
            {status?.running ? (
              <span className="rounded-sm border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-200">
                RUNNING
              </span>
            ) : (
              <span className="rounded-sm border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-xs font-medium text-rose-200">
                STOPPED
              </span>
            )}
          </div>

          {status?.uptime !== null && status?.uptime !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">Uptime</span>
              <span className="text-sm text-white/70">{formatUptime(status.uptime)}</span>
            </div>
          )}

           <div className="flex flex-col gap-3 pt-2 sm:flex-row">
             <Button
               variant="primary"
               onClick={onConfirmRestart}
               disabled={restarting}
               className="flex-1 py-2 text-sm"
             >
               {restarting ? "Restarting..." : "Restart Service"}
             </Button>
           </div>
        </div>
    </section>
  );
}
