"use client";

import { useState, useEffect } from "react";

interface DashboardHeaderProps {
  onUserClick: () => void;
  username: string;
  isAdmin: boolean;
}

interface ProxyStatus {
  running: boolean;
  containerName?: string;
  uptime?: number | null;
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "0m";
  
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);

  return parts.join(" ");
}

export function DashboardHeader({ onUserClick, username, isAdmin }: DashboardHeaderProps) {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/proxy/status");
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();
        if (mounted) {
          setStatus(data);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setStatus({ running: false });
          setLoading(false);
        }
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <header className="w-full bg-slate-900/40 border-b border-slate-700/70 backdrop-blur-sm py-2.5 px-4 lg:px-6 rounded-lg mb-4 flex items-center justify-between">
      {/* Left Side: Status */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-slate-400">Checking...</span>
            </>
          ) : status?.running ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="text-emerald-400 font-medium">All systems operational</span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-red-400 font-medium">System offline</span>
            </>
          )}
        </div>
        
        {status?.running && status.uptime != null && (
          <>
            <div className="w-px h-4 bg-slate-700" />
            <span className="text-slate-400 text-xs">
              Uptime: {formatUptime(status.uptime)}
            </span>
          </>
        )}
      </div>

      {/* Right Side: User */}
      <button 
        onClick={onUserClick}
        aria-label="User settings"
        className="flex items-center gap-3 group transition-all"
      >
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
            {username}
          </span>
          {isAdmin && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
              Admin
            </span>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-slate-800/60 border border-slate-600/50 flex items-center justify-center text-sm font-medium text-slate-200 group-hover:border-blue-400/50 group-hover:shadow-[0_0_10px_rgba(96,165,250,0.2)] transition-all">
          {initial}
        </div>
      </button>
    </header>
  );
}