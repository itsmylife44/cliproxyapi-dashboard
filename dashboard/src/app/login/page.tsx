"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { PublicThemeToggle } from "@/components/public-theme-toggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(API_ENDPOINTS.SETUP.BASE)
      .then((res) => res.json())
      .then((data) => {
        const setupRequired = data.data?.setupRequired ?? data.setupRequired;
        if (setupRequired) {
          router.replace("/setup");
        } else {
          setReady(true);
        }
      })
      .catch(() => setReady(true));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? data.error ?? "Login failed");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center px-4" aria-busy="true" aria-label="Loading">
        <PublicThemeToggle />
        <div className="w-full max-w-sm">
          <span className="sr-only">Loading login page…</span>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-[var(--surface-muted)] animate-pulse" />
            <div className="mx-auto h-7 w-40 rounded bg-[var(--surface-muted)] animate-pulse" />
            <div className="mx-auto mt-2 h-4 w-52 rounded bg-[var(--surface-muted)] animate-pulse" />
          </div>
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <div className="mb-2 h-3 w-20 rounded bg-[var(--surface-muted)] animate-pulse" />
                <div className="h-10 rounded-lg bg-[var(--surface-muted)] animate-pulse" />
              </div>
              <div>
                <div className="mb-2 h-3 w-20 rounded bg-[var(--surface-muted)] animate-pulse" />
                <div className="h-10 rounded-lg bg-[var(--surface-muted)] animate-pulse" />
              </div>
              <div className="h-10 rounded-lg bg-[var(--surface-muted)] animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-4">
      <PublicThemeToggle />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-black shadow-[rgba(0,0,0,0.08)_0px_0px_0px_0.5px]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            CLIProxyAPI
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Sign in to your dashboard</p>
        </div>

         <div className="glass-card rounded-2xl p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-2 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Username
              </label>
              <Input
                type="text"
                name="username"
                value={username}
                onChange={setUsername}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Password
              </label>
              <Input
                type="password"
                name="password"
                value={password}
                onChange={setPassword}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in\u2026" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          CLIProxyAPI Management Dashboard
        </p>
      </div>
    </main>
  );
}
