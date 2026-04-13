"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { extractApiError } from "@/lib/utils";

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  apiKeyCount: number;
}

const EMPTY_USERS: User[] = [];

function UserForm({
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  isAdmin,
  onIsAdminChange,
  passwordLabel,
  passwordPlaceholder,
  passwordHint,
  adminDescription,
  disableAdminToggle = false,
  disabled = false,
}: {
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  isAdmin: boolean;
  onIsAdminChange: (value: boolean) => void;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint?: string;
  adminDescription: string;
  disableAdminToggle?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("users");

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
          {t("usernameLabel")}
        </label>
        <Input
          type="text"
          name="username"
          value={username}
          onChange={onUsernameChange}
          required
          autoComplete="username"
          placeholder={t("usernamePlaceholder")}
          disabled={disabled}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
          {passwordLabel}
        </label>
        <Input
          type="password"
          name="password"
          value={password}
          onChange={onPasswordChange}
          required={passwordLabel === t("passwordLabel")}
          autoComplete="new-password"
          placeholder={passwordPlaceholder}
          disabled={disabled}
        />
        {passwordHint ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{passwordHint}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
          {t("confirmPasswordLabel")}
        </label>
        <Input
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={onConfirmPasswordChange}
          required={passwordLabel === t("passwordLabel")}
          autoComplete="new-password"
          placeholder={t("confirmPasswordPlaceholder")}
          disabled={disabled}
        />
      </div>

      <div>
        <label className={`flex items-center gap-3 ${disableAdminToggle ? "cursor-not-allowed opacity-70" : "cursor-pointer group"}`}>
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => onIsAdminChange(e.target.checked)}
            className="size-4 shrink-0 rounded border-[var(--surface-border)]/70 bg-[var(--surface-base)] text-[var(--text-primary)] focus:ring-2 focus:ring-black/20 focus:ring-offset-0"
            disabled={disabled || disableAdminToggle}
          />
          <span className="text-sm font-medium text-[var(--text-primary)] transition-colors">
            {t("grantAdminLabel")}
          </span>
        </label>
        <p className="mt-1 ml-7 text-xs text-[var(--text-muted)]">{adminDescription}</p>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>(EMPTY_USERS);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmPassword, setCreateConfirmPassword] = useState("");
  const [createIsAdmin, setCreateIsAdmin] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const t = useTranslations("users");
  const tc = useTranslations("common");

  const resetCreateForm = () => {
    setCreateUsername("");
    setCreatePassword("");
    setCreateConfirmPassword("");
    setCreateIsAdmin(false);
  };

  const resetEditForm = () => {
    setEditingUser(null);
    setEditUsername("");
    setEditPassword("");
    setEditConfirmPassword("");
    setEditIsAdmin(false);
  };

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
        showToast(t("toastAdminRequired"), "error");
        router.push("/dashboard");
        return;
      }

      if (!res.ok) {
        setFetchError(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setUsers(Array.isArray(data.data) ? data.data : []);
      setLoading(false);
    } catch {
      if (signal?.aborted) return;
      setFetchError(true);
      setLoading(false);
    }
  }, [router, showToast, t]);

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

  const validateUserForm = ({
    username,
    password,
    confirmPassword,
    passwordRequired,
  }: {
    username: string;
    password: string;
    confirmPassword: string;
    passwordRequired: boolean;
  }) => {
    if (!username.trim()) {
      showToast(t("toastUsernameRequired"), "error");
      return false;
    }

    if (passwordRequired && password.length === 0) {
      showToast(t("toastPasswordTooShort"), "error");
      return false;
    }

    if (password.length > 0 && password.length < 8) {
      showToast(t("toastPasswordTooShort"), "error");
      return false;
    }

    if (password !== confirmPassword) {
      showToast(t("toastPasswordMismatch"), "error");
      return false;
    }

    return true;
  };

  const handleCreateUser = async () => {
    if (
      !validateUserForm({
        username: createUsername,
        password: createPassword,
        confirmPassword: createConfirmPassword,
        passwordRequired: true,
      })
    ) {
      return;
    }

    setCreating(true);

    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.USERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername.trim(),
          password: createPassword,
          isAdmin: createIsAdmin,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, t("toastCreateFailed")), "error");
        setCreating(false);
        return;
      }

      showToast(t("toastCreateSuccess"), "success");
      setIsCreateModalOpen(false);
      resetCreateForm();
      setCreating(false);
      await fetchUsers();
    } catch {
      showToast(t("toastNetworkError"), "error");
      setCreating(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword("");
    setEditConfirmPassword("");
    setEditIsAdmin(user.isAdmin);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    if (
      !validateUserForm({
        username: editUsername,
        password: editPassword,
        confirmPassword: editConfirmPassword,
        passwordRequired: false,
      })
    ) {
      return;
    }

    if (currentUser?.id === editingUser.id && !editIsAdmin) {
      showToast(t("toastSelfAdminRequired"), "error");
      return;
    }

    setEditing(true);

    try {
      const res = await fetch(API_ENDPOINTS.ADMIN.USERS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          username: editUsername.trim(),
          isAdmin: editIsAdmin,
          ...(editPassword.trim() ? { password: editPassword } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, t("toastUpdateFailed")), "error");
        setEditing(false);
        return;
      }

      showToast(t("toastUpdateSuccess"), "success");
      setIsEditModalOpen(false);
      resetEditForm();
      setEditing(false);
      await fetchUsers();
    } catch {
      showToast(t("toastNetworkError"), "error");
      setEditing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!pendingDeleteUser) return;

    setDeleting(true);

    try {
      const res = await fetch(`${API_ENDPOINTS.ADMIN.USERS}?userId=${encodeURIComponent(pendingDeleteUser.id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(extractApiError(data, t("toastDeleteFailed")), "error");
        setDeleting(false);
        return;
      }

      showToast(t("toastDeleteSuccess"), "success");
      setUsers((prev) => prev.filter((user) => user.id !== pendingDeleteUser.id));
      setDeleting(false);
    } catch {
      showToast(t("toastNetworkError"), "error");
      setDeleting(false);
    }
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
      <Breadcrumbs items={[{ label: tc("dashboard"), href: "/dashboard" }, { label: tc("admin") }, { label: t("breadcrumbLabel") }]} />

      <section className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{t("managementTitle")}</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t("pageDescription")}</p>
          </div>
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="px-2.5 py-1 text-xs"
          >
            {t("createUserButton")}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-6 text-center text-sm text-[var(--text-muted)]">
          {t("loadingText")}
        </div>
      ) : fetchError ? (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/100/10 p-4 text-center text-sm text-rose-700">
          {t("errorLoadingUsers")}
          <button
            type="button"
            onClick={() => void fetchUsers()}
            className="ml-2 font-medium text-rose-800 underline underline-offset-2 hover:text-[var(--text-primary)]"
          >
            {t("retryButton")}
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-muted)]">
          {t("emptyState")}
        </div>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface-base)]">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface-base)]/95">
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tableHeaderUsername")}</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tableHeaderRole")}</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tableHeaderCreated")}</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tableHeaderApiKeys")}</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("tableHeaderActions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;

                return (
                  <tr key={user.id} className="border-b border-[var(--surface-border)] last:border-b-0 hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-3 py-2 text-xs font-medium text-[var(--text-primary)]">
                      <div className="flex items-center gap-2">
                        <span>{user.username}</span>
                        {isCurrentUser ? (
                          <span className="inline-flex items-center rounded-sm border border-[var(--surface-border)]/70 bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                            {t("currentUserBadge")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${user.isAdmin ? "border-blue-500/20 bg-blue-500/10 text-blue-700" : "border-[var(--surface-border)]/70 bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
                        {user.isAdmin ? t("roleAdmin") : t("roleUser")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{formatDate(user.createdAt)}</td>
                    <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{user.apiKeyCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => openEditModal(user)} className="px-2.5 py-1 text-xs">
                          {t("editButton")}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            setPendingDeleteUser(user);
                            setShowDeleteConfirm(true);
                          }}
                          className="px-2.5 py-1 text-xs"
                          disabled={isCurrentUser || deleting}
                        >
                          {t("deleteButton")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetCreateForm();
        }}
      >
        <ModalHeader>
          <ModalTitle>{t("createModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <UserForm
            username={createUsername}
            onUsernameChange={setCreateUsername}
            password={createPassword}
            onPasswordChange={setCreatePassword}
            confirmPassword={createConfirmPassword}
            onConfirmPasswordChange={setCreateConfirmPassword}
            isAdmin={createIsAdmin}
            onIsAdminChange={setCreateIsAdmin}
            passwordLabel={t("passwordLabel")}
            passwordPlaceholder={t("passwordPlaceholder")}
            adminDescription={t("grantAdminDescription")}
            disabled={creating}
          />
        </ModalContent>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsCreateModalOpen(false);
              resetCreateForm();
            }}
            disabled={creating}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={handleCreateUser} disabled={creating}>
            {creating ? t("creating") : t("createUserButton")}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetEditForm();
        }}
      >
        <ModalHeader>
          <ModalTitle>{t("editModalTitle")}</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <UserForm
            username={editUsername}
            onUsernameChange={setEditUsername}
            password={editPassword}
            onPasswordChange={setEditPassword}
            confirmPassword={editConfirmPassword}
            onConfirmPasswordChange={setEditConfirmPassword}
            isAdmin={editIsAdmin}
            onIsAdminChange={setEditIsAdmin}
            passwordLabel={t("newPasswordLabel")}
            passwordPlaceholder={t("newPasswordPlaceholder")}
            passwordHint={t("newPasswordHint")}
            adminDescription={currentUser?.id === editingUser?.id ? t("selfAdminHint") : t("grantAdminDescription")}
            disableAdminToggle={currentUser?.id === editingUser?.id}
            disabled={editing}
          />
        </ModalContent>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsEditModalOpen(false);
              resetEditForm();
            }}
            disabled={editing}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={handleUpdateUser} disabled={editing}>
            {editing ? t("updating") : t("updateUserButton")}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPendingDeleteUser(null);
        }}
        onConfirm={handleDeleteUser}
        title={t("deleteConfirmTitle")}
        message={
          pendingDeleteUser
            ? t("deleteConfirmMessage", { username: pendingDeleteUser.username })
            : t("deleteConfirmFallbackMessage")
        }
        confirmLabel={t("deleteConfirmButton")}
        cancelLabel={t("deleteConfirmCancelButton")}
        variant="danger"
      />
    </div>
  );
}
