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

type UserItem = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: "ADMIN" | "USER";
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
    role: "ADMIN" | "USER";
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
  const [newUser, setNewUser] = useState({
    nama: "",
    jabatan: "",
    nip: "",
    role: "USER" as "ADMIN" | "USER",
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
      setDrafts(
        Object.fromEntries(
          loadedUsers.map((user: UserItem) => [
            user.id,
            {
              nama: user.nama,
              jabatan: user.jabatan || "",
              nip: user.nip || "",
              role: user.role,
            },
          ])
        )
      );
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
    }, 2000);

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
    const draft = drafts[userId];

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
        String(user.id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [debouncedSearchQuery, users]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/75">
              Admin Panel
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Kelola User</h1>
            <p className="mt-3 max-w-3xl text-white/70">
              Buat akun pegawai atau admin baru, perbarui identitas internal, dan reset password tanpa memakai script manual.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Muat Ulang
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/admin")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </button>
          </div>
        </div>

        {message ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm">
            {message}
          </div>
        ) : null}

        <section className="mb-8 rounded-[32px] border border-white/10 bg-white/[0.08] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.16)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-400/10">
              <UserPlus className="h-6 w-6 text-cyan-100" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Tambah User</h2>
              <p className="text-sm text-white/60">
                Buat akun baru untuk pegawai atau admin.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <input
              value={newUser.nama}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, nama: event.target.value }))
              }
              placeholder="Nama"
              className="h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-white/35"
            />

            <input
              value={newUser.jabatan}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, jabatan: event.target.value }))
              }
              placeholder="Jabatan"
              className="h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-white/35"
            />

            <input
              value={newUser.nip}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, nip: event.target.value }))
              }
              placeholder="NIP"
              className="h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-white/35"
            />

            <select
              value={newUser.role}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  role: event.target.value as "ADMIN" | "USER",
                }))
              }
              className="h-14 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-white outline-none"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            <input
              type="password"
              value={newUser.password}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Password"
              className="h-14 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-white/35"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateUser}
            className="mt-5 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 font-semibold text-white transition hover:bg-cyan-400"
          >
            <UserPlus className="h-4 w-4" />
            Buat User
          </button>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.08] shadow-[0_24px_60px_rgba(2,6,23,0.16)]">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Daftar User</h2>
                <p className="mt-1 text-sm text-white/55">
                  {filteredUsers.length} dari {users.length} user ditampilkan.
                </p>
              </div>

              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama, NIP, jabatan, atau role"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-11 pr-4 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/30"
                />
              </label>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-white/70">Memuat daftar user...</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-8 text-white/70">Belum ada user.</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-8 text-white/70">
              Tidak ada user yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {filteredUsers.map((user) => {
                const draft = drafts[user.id] || {
                  nama: user.nama,
                  jabatan: user.jabatan || "",
                  nip: user.nip || "",
                  role: user.role,
                };
                const activeReportCount = user._count.activeReports || 0;
                const canDeleteUser =
                  activeReportCount === 0 && user.id !== currentUserId;
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
                    className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5"
                  >
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_180px_auto]">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-white/55">NIP</p>
                          <p className="mt-1 font-semibold text-white">
                            {user.nip || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-white/55">Jabatan</p>
                          <p className="mt-1 font-semibold text-white">
                            {user.jabatan || "-"}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-sm text-white/60">
                              Nama
                            </label>
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
                              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/60">
                              NIP
                            </label>
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
                              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/60">
                              Jabatan
                            </label>
                            <input
                              value={draft.jabatan}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...draft,
                                    jabatan: event.target.value,
                                  },
                                }))
                              }
                              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm text-white/55">Role</p>
                          <select
                            value={draft.role}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [user.id]: {
                                  ...draft,
                                  role: event.target.value as "ADMIN" | "USER",
                                },
                              }))
                            }
                            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-white outline-none"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-sm text-white/55">Jumlah Laporan</p>
                          <p className="mt-2 text-2xl font-bold text-white">
                            {user._count.reports}
                          </p>
                          <p className="mt-1 text-xs text-white/50">
                            Aktif: {activeReportCount}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <label className="mb-2 block text-sm text-white/60">
                            Password Baru
                          </label>
                          <input
                            type="password"
                            value={passwordDrafts[user.id] || ""}
                            onChange={(event) =>
                              setPasswordDrafts((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                            className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-white/55">Status Penghapusan</p>
                        <p className="mt-2 text-sm text-white/75">
                          {deletionStatus}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => void handleSaveUser(user.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400"
                        >
                          <Save className="h-4 w-4" />
                          Simpan
                        </button>

                        <button
                          type="button"
                          disabled={!passwordDrafts[user.id]}
                          onClick={() => void handleResetPassword(user.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/18 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <KeyRound className="h-4 w-4" />
                          Reset Password
                        </button>

                        <button
                          type="button"
                          disabled={!canDeleteUser}
                          onClick={() => void handleDeleteUser(user.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/18 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
