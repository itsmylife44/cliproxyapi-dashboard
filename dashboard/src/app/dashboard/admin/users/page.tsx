"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { extractApiError } from "@/lib/utils";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  apiKeyCount: number;
}

const EMPTY_USERS: User[] = [];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>(EMPTY_USERS);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { showToast } = useToast();
  const router = useRouter();

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.USERS, { signal });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) {
        showToast("Admin access required", "error");
        router.push("/dashboard");
        return;
      }

      if (!res.ok) {
        setFetchError(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      const userList = Array.isArray(data.data) ? data.data : [];
      setUsers(userList);
      setLoading(false);
    } catch {
      if (signal?.aborted) return;
      setFetchError(true);
      setLoading(false);
    }
  }, [showToast, router]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchUsers(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchUsers]);

  const handleCreateUser = async () => {
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    if (password.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    if (!username.trim()) {
      showToast("Username is required", "error");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.USERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, isAdmin }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, "Failed to create user"), "error");
        setCreating(false);
        return;
      }

      showToast("User created successfully", "success");
      setIsModalOpen(false);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setIsAdmin(false);
      setCreating(false);
      fetchUsers();
    } catch {
      showToast("Network error", "error");
      setCreating(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setIsAdmin(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Users" }]} />
      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">User Management</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Manage dashboard users and roles.</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="px-2.5 py-1 text-xs">Create User</Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">Loading...</div>
      ) : fetchError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
          Failed to load users.
          <button type="button" onClick={() => void fetchUsers()} className="ml-2 font-medium text-rose-800 underline underline-offset-2 hover:text-black">
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-muted)]">
          No users found. Create one to get started.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
          <table className="min-w-[600px] w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]/95">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Username</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Role</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Created</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">API Keys</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--surface-border)] last:border-b-0 hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="px-3 py-2 text-xs font-medium text-[var(--text-primary)]">{user.username}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${user.isAdmin ? "border-blue-200 bg-blue-50 text-blue-700" : "border-[var(--surface-border)]/70 bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{formatDate(user.createdAt)}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{user.apiKeyCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <ModalHeader>
          <ModalTitle>Create New User</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Username
              </label>
              <Input
                type="text"
                name="username"
                value={username}
                onChange={setUsername}
                required
                autoComplete="username"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
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
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Confirm Password
              </label>
              <Input
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="size-4 shrink-0 cursor-pointer rounded border-[var(--surface-border)]/70 bg-[var(--surface-base)] text-[var(--text-primary)] focus:ring-2 focus:ring-black/20 focus:ring-offset-0"
                />
                <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Grant admin privileges
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-[var(--text-muted)]">
                Admins can manage users and access all system features
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={handleCloseModal} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreateUser} disabled={creating}>
            {creating ? "Creating..." : "Create User"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
