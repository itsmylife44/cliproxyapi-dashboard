"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { showToast } = useToast();
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      
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
        showToast("Failed to load users", "error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const userList = Array.isArray(data.data) ? data.data : [];
      setUsers(userList);
      setLoading(false);
    } catch {
      showToast("Network error", "error");
      setLoading(false);
    }
  }, [showToast, router]);

  useEffect(() => {
    void fetchUsers();
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
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, isAdmin }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to create user", "error");
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
      <section className="rounded-lg border border-slate-700/70 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">User Management</h1>
            <p className="mt-1 text-xs text-slate-400">Manage dashboard users and roles.</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="px-2.5 py-1 text-xs">Create User</Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-6 text-center text-sm text-slate-400">Loading...</div>
      ) : users.length === 0 ? (
        <div className="rounded-md border border-slate-700/70 bg-slate-900/25 p-4 text-sm text-slate-400">
          No users found. Create one to get started.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-md border border-slate-700/70 bg-slate-900/25">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/70 bg-slate-900/60">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Username</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Role</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Created</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">API Keys</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-700/60 last:border-b-0 hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-2 text-xs font-medium text-slate-100">{user.username}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${user.isAdmin ? "border-blue-500/40 bg-blue-500/10 text-blue-200" : "border-slate-600/70 bg-slate-700/40 text-slate-300"}`}>
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{formatDate(user.createdAt)}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{user.apiKeyCount}</td>
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
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-300">
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
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
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
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-300">
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
                  className="size-4 shrink-0 cursor-pointer rounded border-slate-600/70 bg-slate-900/40 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm font-medium text-slate-200 group-hover:text-slate-100 transition-colors">
                  Grant admin privileges
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-slate-500">
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
