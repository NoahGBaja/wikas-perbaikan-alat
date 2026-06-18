"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  KeyRound,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { AppRole } from "@/src/lib/roles";
import { getRoleLabel } from "@/src/lib/roles";

const ROLE_OPTIONS: AppRole[] = [
  "USER",
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "ADMIN_6",
  "SUPER_ADMIN",
];

const USER_PAGE_SIZE = 12;

type UserItem = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: AppRole;
  createdAt: string;
  _count: {
    reports: number;
    activeReports: number;
  };
};

type DraftMap = Record<
  number,
  {
    nama: string;
    jabatan: string;
    nip: string;
    role: AppRole;
  }
>;

type PasswordDraftMap = Record<number, string>;

type AdminUsersPageProps = {
  currentUserId: number;
};

async function readApiResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();

  return {
    message:
      text.trim().slice(0, 180) ||
      `Request gagal dengan status ${res.status}.`,
  };
}

export default function AdminUsersPage({
  currentUserId,
}: AdminUsersPageProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [passwordDrafts, setPasswordDrafts] = useState<PasswordDraftMap>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(USER_PAGE_SIZE);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({
    nama: "",
    jabatan: "",
    nip: "",
    role: "USER" as AppRole,
    password: "",
  });

  async function loadUsers() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/admin/users", {
        cache: "no-store",
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        const errorMessage = data.message || "Gagal memuat daftar user.";

        setMessage(errorMessage);
        toast.error("Gagal memuat user", {
          description: errorMessage,
        });
        return;
      }

      const loadedUsers = data.users || [];
      setUsers(loadedUsers);
      setDrafts({});
      setPasswordDrafts({});
      setVisibleLimit(USER_PAGE_SIZE);
      setExpandedUserId(null);
    } catch (error) {
      console.error("LOAD_ADMIN_USERS_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat memuat daftar user.";

      setMessage(errorMessage);
      toast.error("Gagal memuat user", {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setVisibleLimit(USER_PAGE_SIZE);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  async function handleCreateUser() {
    try {
      setMessage("");

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "User berhasil dibuat.";

      setMessage(responseMessage);

      if (!res.ok) {
        toast.error("Gagal membuat user", {
          description: responseMessage,
        });
        return;
      }

      toast.success("User dibuat", {
        description: responseMessage,
      });
      setNewUser({
        nama: "",
        jabatan: "",
        nip: "",
        role: "USER",
        password: "",
      });
      await loadUsers();
    } catch (error) {
      console.error("CREATE_ADMIN_USER_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat membuat user.";

      setMessage(errorMessage);
      toast.error("Gagal membuat user", {
        description: errorMessage,
      });
    }
  }

  async function handleSaveUser(userId: number) {
    const user = users.find((item) => item.id === userId);
    const draft =
      drafts[userId] ||
      (user
        ? {
            nama: user.nama,
            jabatan: user.jabatan || "",
            nip: user.nip || "",
            role: user.role,
          }
        : null);

    if (!draft) {
      return;
    }

    try {
      setMessage("");

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "User berhasil diperbarui.";

      setMessage(responseMessage);

      if (!res.ok) {
        toast.error("Gagal memperbarui user", {
          description: responseMessage,
        });
        return;
      }

      toast.success("User diperbarui", {
        description: responseMessage,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      setExpandedUserId(null);
      await loadUsers();
    } catch (error) {
      console.error("UPDATE_ADMIN_USER_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat memperbarui user.";

      setMessage(errorMessage);
      toast.error("Gagal memperbarui user", {
        description: errorMessage,
      });
    }
  }

  async function handleResetPassword(userId: number) {
    const password = passwordDrafts[userId] || "";

    try {
      setMessage("");

      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "Password user berhasil direset.";

      setMessage(responseMessage);

      if (!res.ok) {
        toast.error("Reset password gagal", {
          description: responseMessage,
        });
        return;
      }

      toast.success("Password direset", {
        description: responseMessage,
      });
      setPasswordDrafts((current) => ({
        ...current,
        [userId]: "",
      }));
    } catch (error) {
      console.error("RESET_ADMIN_USER_PASSWORD_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat mereset password user.";

      setMessage(errorMessage);
      toast.error("Reset password gagal", {
        description: errorMessage,
      });
    }
  }

  async function handleDeleteUser(userId: number) {
    const user = users.find((item) => item.id === userId);
    const confirmed = window.confirm(
      user && user._count.reports > 0
        ? "Hapus user ini? Akun akan dinonaktifkan, tetapi riwayat laporan tetap tersimpan."
        : "Hapus user ini? Akun akan dinonaktifkan."
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "User berhasil dihapus.";

      setMessage(responseMessage);

      if (!res.ok) {
        toast.error("Gagal menghapus user", {
          description: responseMessage,
        });
        return;
      }

      toast.success("User dihapus", {
        description: responseMessage,
      });
      setUsers((current) => current.filter((user) => user.id !== userId));
      setExpandedUserId((current) => (current === userId ? null : current));
      setDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    } catch (error) {
      console.error("DELETE_ADMIN_USER_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat menghapus user.";

      setMessage(errorMessage);
      toast.error("Gagal menghapus user", {
        description: errorMessage,
      });
    }
  }

  const filteredUsers = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [
        user.nama,
        user.jabatan || "",
        user.nip || "",
        user.role,
        getRoleLabel(user.role),
        String(user.id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [debouncedSearchQuery, users]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleLimit),
    [filteredUsers, visibleLimit]
  );
  const hiddenUserCount = Math.max(filteredUsers.length - visibleUsers.length, 0);

  function getDraftForUser(user: UserItem) {
    return (
      drafts[user.id] || {
        nama: user.nama,
        jabatan: user.jabatan || "",
        nip: user.nip || "",
        role: user.role,
      }
    );
  }

  function toggleExpandedUser(user: UserItem) {
    setExpandedUserId((current) => {
      if (current === user.id) {
        return null;
      }

      setDrafts((drafts) => ({
        ...drafts,
        [user.id]: getDraftForUser(user),
      }));

      return user.id;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Admin Panel
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Kelola User</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Buat akun, atur role, dan reset password tanpa memakai script manual.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </button>

            <button
              type="button"
              onClick={() => void loadUsers()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Muat Ulang
            </button>
          </div>
        </div>

        {message ? (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        ) : null}

        <section className="mb-5 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Tambah User</h2>
                <p className="text-xs text-slate-500">
                  Form dibuka hanya saat dibutuhkan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              <UserPlus className="h-4 w-4" />
              {showCreateForm ? "Tutup Form" : "Tambah User"}
            </button>
          </div>

          {showCreateForm ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
                <input
                  value={newUser.nama}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      nama: event.target.value,
                    }))
                  }
                  placeholder="Nama"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />

                <input
                  value={newUser.nip}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      nip: event.target.value,
                    }))
                  }
                  placeholder="NIP"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />

                <select
                  value={newUser.role}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      role: event.target.value as AppRole,
                    }))
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>

                <input
                  type="password"
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Password"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateUser}
                className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                <UserPlus className="h-4 w-4" />
                Buat User
              </button>
            </>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/30 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Daftar User</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {visibleUsers.length} dari {filteredUsers.length} user
                  ditampilkan.
                </p>
              </div>

              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama, NIP, atau role"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-slate-600">Memuat daftar user...</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-8 text-slate-600">Belum ada user.</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-8 text-slate-600">
              Tidak ada user yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {visibleUsers.map((user) => {
                const draft = getDraftForUser(user);
                const activeReportCount = user._count.activeReports || 0;
                const canDeleteUser =
                  activeReportCount === 0 && user.id !== currentUserId;
                const expanded = expandedUserId === user.id;
                const deletionStatus =
                  user.id === currentUserId
                    ? "Akun admin aktif tidak bisa dihapus."
                      : activeReportCount > 0
                        ? "Tidak bisa dihapus karena masih memiliki laporan aktif."
                      : user._count.reports > 0
                        ? "Bisa dihapus. Riwayat laporan tertutup tetap tersimpan."
                        : "Aman untuk dihapus bila memang tidak digunakan.";

                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">
                          {user.nama}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          NIP: {user.nip || "-"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                          {getRoleLabel(user.role)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                          {user._count.reports} laporan
                        </span>
                        <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-amber-700">
                          {activeReportCount} aktif
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpandedUser(user)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50"
                      >
                        {expanded ? "Tutup" : "Kelola"}
                      </button>
                    </div>

                    {expanded ? (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                          <label className="grid gap-1 text-xs font-medium text-slate-500">
                            Nama
                            <input
                              value={draft.nama}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...draft,
                                    nama: event.target.value,
                                  },
                                }))
                              }
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-medium text-slate-500">
                            NIP
                            <input
                              value={draft.nip}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...draft,
                                    nip: event.target.value,
                                  },
                                }))
                              }
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-medium text-slate-500">
                            Role
                            <select
                              value={draft.role}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...draft,
                                    role: event.target.value as AppRole,
                                  },
                                }))
                              }
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {getRoleLabel(role)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-1 text-xs font-medium text-slate-500">
                            Password Baru
                            <input
                              type="password"
                              value={passwordDrafts[user.id] || ""}
                              onChange={(event) =>
                                setPasswordDrafts((current) => ({
                                  ...current,
                                  [user.id]: event.target.value,
                                }))
                              }
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>
                        </div>

                        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <p className="text-xs leading-5 text-slate-500">
                            {deletionStatus}
                          </p>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => void handleSaveUser(user.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                            >
                              <Save className="h-4 w-4" />
                              Simpan
                            </button>

                            <button
                              type="button"
                              disabled={!passwordDrafts[user.id]}
                              onClick={() => void handleResetPassword(user.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <KeyRound className="h-4 w-4" />
                              Reset Password
                            </button>

                            <button
                              type="button"
                              disabled={!canDeleteUser}
                              onClick={() => void handleDeleteUser(user.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {hiddenUserCount > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLimit((current) => current + USER_PAGE_SIZE)
                  }
                  className="w-full rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Tampilkan {Math.min(USER_PAGE_SIZE, hiddenUserCount)} user lagi
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
