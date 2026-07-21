"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  KeyRound,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import {
  getCategoryScopeLabel,
  getRoleLabel,
  isCategoryScopedRole,
} from "@/src/lib/roles";
import {
  PASSWORD_REQUIREMENT_TEXT,
  validatePasswordStrength,
} from "@/src/lib/password-rules";
import PasswordInput from "@/src/components/ui/PasswordInput";
import {
  FeedbackBanner,
  showError,
  showSuccess,
  toFeedback,
  type FeedbackMessage,
} from "@/src/components/ui/feedback";

const ROLE_OPTIONS: AppRole[] = [
  "USER",
  "ADMIN_1",
  "ADMIN_2",
  "ADMIN_3",
  "ADMIN_4",
  "ADMIN_5",
  "EXECUTIVE",
];

const USER_PAGE_SIZE = 12;
const SERVER_SEARCH_DELAY_MS = 1500;
const MIN_SERVER_SEARCH_LENGTH = 3;

const CATEGORY_SCOPE_OPTIONS: AppCategoryScope[] = [
  "FASILITAS_INVENTARIS",
  "IT_ELEKTRONIK",
  "LABORATORIUM",
];

type UserItem = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: AppRole;
  isSuperAdmin: boolean;
  categoryScope: AppCategoryScope | null;
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
    isSuperAdmin: boolean;
    categoryScope: AppCategoryScope | "";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [totalUsers, setTotalUsers] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({
    nama: "",
    jabatan: "",
    nip: "",
    role: "USER" as AppRole,
    isSuperAdmin: false,
    categoryScope: "" as AppCategoryScope | "",
    password: "",
  });

  const loadUsers = useCallback(async (options: {
    append?: boolean;
    search?: string;
    offset?: number;
  } = {}) => {
    const append = options.append === true;
    const search = options.search ?? "";
    const offset = options.offset ?? 0;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setMessage(null);

      const params = new URLSearchParams({
        limit: String(USER_PAGE_SIZE),
        offset: String(offset),
      });

      if (search.trim()) {
        params.set("q", search.trim());
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        const errorMessage = data.message || "Gagal memuat daftar pengguna.";

        setMessage(toFeedback(errorMessage, "error"));
        showError("Gagal memuat pengguna", errorMessage);
        return;
      }

      const loadedUsers = data.users || [];
      setUsers((current) => (append ? [...current, ...loadedUsers] : loadedUsers));
      setTotalUsers(Number(data.total || 0));

      if (!append) {
        setDrafts({});
        setPasswordDrafts({});
        setExpandedUserId(null);
      }
    } catch (error) {
      console.error("LOAD_ADMIN_USERS_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat memuat daftar pengguna.";

      setMessage(toFeedback(errorMessage, "error"));
      showError("Gagal memuat pengguna", errorMessage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SERVER_SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const search = debouncedSearchQuery.trim();

    if (search && search.length < MIN_SERVER_SEARCH_LENGTH) {
      setUsers([]);
      setTotalUsers(0);
      setLoading(false);
      return;
    }

    void loadUsers({ search: debouncedSearchQuery });
  }, [debouncedSearchQuery, loadUsers]);

  async function handleCreateUser() {
    const passwordErrors = validatePasswordStrength(newUser.password);

    if (passwordErrors.length > 0) {
      setMessage(toFeedback(passwordErrors[0], "error"));
      showError("Gagal membuat pengguna", passwordErrors[0]);
      return;
    }

    try {
      setMessage(null);

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "Pengguna berhasil dibuat.";

      if (!res.ok) {
        setMessage(toFeedback(responseMessage, "error"));
        showError("Gagal membuat pengguna", responseMessage);
        return;
      }

      setMessage(toFeedback(responseMessage, "success"));
      showSuccess("Pengguna dibuat", responseMessage);
      setNewUser({
        nama: "",
        jabatan: "",
        nip: "",
        role: "USER",
        isSuperAdmin: false,
        categoryScope: "",
        password: "",
      });
      await loadUsers({ search: debouncedSearchQuery });
    } catch (error) {
      console.error("CREATE_ADMIN_USER_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat membuat pengguna.";

      setMessage(toFeedback(errorMessage, "error"));
      showError("Gagal membuat pengguna", errorMessage);
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
            isSuperAdmin: user.isSuperAdmin,
            categoryScope: user.categoryScope || "",
          }
        : null);

    if (!draft) {
      return;
    }

    try {
      setMessage(null);

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "Pengguna berhasil diperbarui.";

      if (!res.ok) {
        setMessage(toFeedback(responseMessage, "error"));
        showError("Gagal memperbarui pengguna", responseMessage);
        return;
      }

      setMessage(toFeedback(responseMessage, "success"));
      showSuccess("Pengguna diperbarui", responseMessage);
      setDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      setExpandedUserId(null);
      await loadUsers({ search: debouncedSearchQuery });
    } catch (error) {
      console.error("UPDATE_ADMIN_USER_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat memperbarui pengguna.";

      setMessage(toFeedback(errorMessage, "error"));
      showError("Gagal memperbarui pengguna", errorMessage);
    }
  }

  async function handleResetPassword(userId: number) {
    const password = passwordDrafts[userId] || "";
    const passwordErrors = validatePasswordStrength(password);

    if (passwordErrors.length > 0) {
      setMessage(toFeedback(passwordErrors[0], "error"));
      showError("Reset kata sandi gagal", passwordErrors[0]);
      return;
    }

    try {
      setMessage(null);

      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "Kata sandi pengguna berhasil direset.";

      if (!res.ok) {
        setMessage(toFeedback(responseMessage, "error"));
        showError("Reset kata sandi gagal", responseMessage);
        return;
      }

      setMessage(toFeedback(responseMessage, "success"));
      showSuccess("Kata sandi direset", responseMessage);
      setPasswordDrafts((current) => ({
        ...current,
        [userId]: "",
      }));
    } catch (error) {
      console.error("RESET_ADMIN_USER_PASSWORD_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat mereset kata sandi pengguna.";

      setMessage(toFeedback(errorMessage, "error"));
      showError("Reset kata sandi gagal", errorMessage);
    }
  }

  async function handleDeleteUser(userId: number) {
    const user = users.find((item) => item.id === userId);
    const confirmed = window.confirm(
      user && user._count.reports > 0
        ? "Hapus pengguna ini? Akun akan dinonaktifkan, tetapi riwayat laporan tetap tersimpan."
        : "Hapus pengguna ini? Akun akan dinonaktifkan."
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage(null);

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "Pengguna berhasil dihapus.";

      if (!res.ok) {
        setMessage(toFeedback(responseMessage, "error"));
        showError("Gagal menghapus pengguna", responseMessage);
        return;
      }

      setMessage(toFeedback(responseMessage, "success"));
      showSuccess("Pengguna dihapus", responseMessage);
      setUsers((current) => current.filter((user) => user.id !== userId));
      setTotalUsers((current) => Math.max(current - 1, 0));
      setExpandedUserId((current) => (current === userId ? null : current));
      setDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    } catch (error) {
      console.error("DELETE_ADMIN_USER_ERROR:", error);
      const errorMessage = "Terjadi kesalahan saat menghapus pengguna.";

      setMessage(toFeedback(errorMessage, "error"));
      showError("Gagal menghapus pengguna", errorMessage);
    }
  }

  const hiddenUserCount = Math.max(totalUsers - users.length, 0);

  function getDraftForUser(user: UserItem) {
    return (
      drafts[user.id] || {
        nama: user.nama,
        jabatan: user.jabatan || "",
        nip: user.nip || "",
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        categoryScope: user.categoryScope || "",
      }
    );
  }

  async function handleExportUsers() {
    try {
      setExporting(true);
      setShowExportModal(false);
      setMessage(null);

      const params = new URLSearchParams();

      if (debouncedSearchQuery.trim()) {
        params.set("q", debouncedSearchQuery.trim());
      }

      const res = await fetch(`/api/admin/users/export?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await readApiResponse(res);
        const text = data.message || "Gagal mengekspor daftar pengguna.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal mengekspor pengguna", text);
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || "daftar-user.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("EXPORT_ADMIN_USERS_ERROR:", error);
      const text = "Terjadi kesalahan saat mengekspor daftar pengguna.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal mengekspor pengguna", text);
    } finally {
      setExporting(false);
    }
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
              Panel Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Kelola Pengguna</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Buat akun, atur peran, dan reset kata sandi tanpa memakai skrip manual.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dasbor
            </button>

            <button
              type="button"
              onClick={() => void loadUsers({ search: debouncedSearchQuery })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Muat Ulang
            </button>

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Mengekspor..." : "Ekspor Excel"}
            </button>
          </div>
        </div>

        {showExportModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <h2 className="text-xl font-bold text-slate-950">Filter Ekspor</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Daftar pengguna akan diekspor setelah konfirmasi. Gunakan kotak
                pencarian di halaman ini untuk mempersempit daftar sebelum
                ekspor jika diperlukan.
              </p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p>Pencarian aktif: {debouncedSearchQuery.trim() || "Tidak ada"}</p>
                <p>Total data ditampilkan: {users.length} dari {totalUsers}</p>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportUsers()}
                  disabled={exporting}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {exporting ? "Mengekspor..." : "Mulai Ekspor"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <FeedbackBanner message={message} className="mb-6" />

        <section className="mb-5 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Tambah Pengguna</h2>
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
              {showCreateForm ? "Tutup Form" : "Tambah Pengguna"}
            </button>
          </div>

          {showCreateForm ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
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
                      categoryScope: isCategoryScopedRole(event.target.value)
                        ? current.categoryScope
                        : "",
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

                <select
                  value={newUser.categoryScope}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      categoryScope: event.target.value as AppCategoryScope | "",
                    }))
                  }
                  disabled={!isCategoryScopedRole(newUser.role)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Kategori</option>
                  {CATEGORY_SCOPE_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryScopeLabel(category)}
                    </option>
                  ))}
                </select>

                <PasswordInput
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Kata sandi"
                  minLength={8}
                  pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
                  title={PASSWORD_REQUIREMENT_TEXT}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />

                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newUser.isSuperAdmin}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        isSuperAdmin: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  Admin Utama
                </label>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {PASSWORD_REQUIREMENT_TEXT}
              </p>

              <button
                type="button"
                onClick={handleCreateUser}
                className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                <UserPlus className="h-4 w-4" />
                Buat Pengguna
              </button>
            </>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/30 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Daftar Pengguna</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {users.length} dari {totalUsers} pengguna ditampilkan.
                </p>
              </div>

              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama, NIP, atau peran minimal 3 karakter"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-slate-600">Memuat daftar pengguna...</div>
          ) : searchQuery.trim().length > 0 &&
            searchQuery.trim().length < MIN_SERVER_SEARCH_LENGTH ? (
            <div className="px-6 py-8 text-slate-600">
              Ketik minimal {MIN_SERVER_SEARCH_LENGTH} karakter untuk mulai mencari.
            </div>
          ) : users.length === 0 && !debouncedSearchQuery.trim() ? (
            <div className="px-6 py-8 text-slate-600">Belum ada pengguna.</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-8 text-slate-600">
              Tidak ada pengguna yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {users.map((user) => {
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
                        {user.isSuperAdmin ? (
                          <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 font-semibold text-violet-700">
                            Admin Utama
                          </span>
                        ) : null}
                        {isCategoryScopedRole(user.role) ? (
                          <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-cyan-700">
                            {getCategoryScopeLabel(user.categoryScope)}
                          </span>
                        ) : null}
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
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
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
                            Peran
                            <select
                              value={draft.role}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...draft,
                                    role: event.target.value as AppRole,
                                    categoryScope: isCategoryScopedRole(
                                      event.target.value,
                                    )
                                      ? draft.categoryScope
                                      : "",
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
                            Kategori
                            <select
                              value={draft.categoryScope}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user.id]: {
                                    ...draft,
                                    categoryScope: event.target
                                      .value as AppCategoryScope | "",
                                  },
                                }))
                              }
                              disabled={!isCategoryScopedRole(draft.role)}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">Tidak khusus</option>
                              {CATEGORY_SCOPE_OPTIONS.map((category) => (
                                <option key={category} value={category}>
                                  {getCategoryScopeLabel(category)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-1 text-xs font-medium text-slate-500">
                            Kata Sandi Baru
                            <PasswordInput
                              value={passwordDrafts[user.id] || ""}
                              onChange={(event) =>
                                setPasswordDrafts((current) => ({
                                  ...current,
                                  [user.id]: event.target.value,
                                }))
                              }
                              minLength={8}
                              pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
                              title={PASSWORD_REQUIREMENT_TEXT}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-medium text-slate-500">
                            Akses
                            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={draft.isSuperAdmin}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [user.id]: {
                                      ...draft,
                                      isSuperAdmin: event.target.checked,
                                    },
                                  }))
                                }
                                className="h-4 w-4 accent-blue-600"
                              />
                              Admin Utama
                            </span>
                          </label>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {PASSWORD_REQUIREMENT_TEXT}
                        </p>

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
                              Reset Kata Sandi
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
                    void loadUsers({
                      append: true,
                      search: debouncedSearchQuery,
                      offset: users.length,
                    })
                  }
                  disabled={loadingMore}
                  className="w-full rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  {loadingMore
                    ? "Memuat..."
                    : `Tampilkan ${Math.min(USER_PAGE_SIZE, hiddenUserCount)} pengguna lagi`}
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
