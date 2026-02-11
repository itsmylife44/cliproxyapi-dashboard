"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
          User Management
        </h1>
        <Button onClick={() => setIsModalOpen(true)}>
          Create User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 text-center text-white">Loading...</div>
          ) : users.length === 0 ? (
            <div className="border-l-4 border-white/30 backdrop-blur-xl bg-white/5 p-4 text-sm text-white/80 rounded-r-xl">
              No users found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 font-medium text-white/70">Username</th>
                    <th className="text-left py-3 px-4 font-medium text-white/70">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-white/70">Created</th>
                    <th className="text-left py-3 px-4 font-medium text-white/70">API Keys</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        {user.username}
                      </td>
                      <td className="py-3 px-4">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-medium text-purple-300 border border-purple-400/30">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300 border border-blue-400/30">
                            User
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-white/70 text-xs">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-white/70">
                        {user.apiKeyCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <ModalHeader>
          <ModalTitle>Create New User</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-white/90">
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
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-white/90">
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
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-white/90">
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
                  className="size-4 shrink-0 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                  Grant admin privileges
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-white/60">
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
