"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Setup failed");
        setLoading(false);
        return;
      }

      setApiKey(data.apiKey);
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 shadow-lg shadow-purple-600/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <title>Setup</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            CLIProxyAPI
          </h1>
          <p className="mt-1 text-sm text-white/50">First-time setup</p>
        </div>

         <div className="glass-card rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="mb-5 rounded-xl bg-amber-500/15 border border-amber-400/25 p-3 text-sm text-amber-200">
            Create your administrator account. Keep these credentials secure.
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-xs font-medium text-white/70 uppercase tracking-wider">
                Username
              </label>
              <Input
                type="text"
                name="username"
                value={username}
                onChange={setUsername}
                required
                autoComplete="username"
                placeholder="admin"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-medium text-white/70 uppercase tracking-wider">
                Password
              </label>
              <Input
                type="password"
                name="password"
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-xs font-medium text-white/70 uppercase tracking-wider">
                Confirm Password
              </label>
              <Input
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/20 border border-red-400/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          CLIProxyAPI Management Dashboard
        </p>
      </div>

      <Modal isOpen={apiKey !== null} onClose={() => {}}>
        <ModalHeader>
          <ModalTitle>Your API Key</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-4 text-sm rounded-xl">
              <div className="mb-2 font-medium text-white">Copy this key now</div>
              <div className="relative group">
                <div className="break-all backdrop-blur-xl bg-white/5 border border-white/20 p-3 pr-12 text-xs text-white font-mono rounded-lg">
                  {apiKey}
                </div>
                <button
                  type="button"
                  onClick={() => apiKey && copyToClipboard(apiKey)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-md border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all duration-200 active:scale-95"
                  title="Copy API key"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
            <div className="border-l-4 border-yellow-400/60 bg-yellow-500/20 backdrop-blur-xl p-3 text-sm rounded-r-xl">
              <span className="text-white/90">This key will only be shown once. Store it securely.</span>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button onClick={() => { router.push("/dashboard"); router.refresh(); }}>
            I have saved it
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
