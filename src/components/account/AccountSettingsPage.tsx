"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import type { AppRole } from "@/src/lib/roles";
import { isAdminRole } from "@/src/lib/roles";

type AccountUser = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: AppRole;
};

type AccountSettingsPageProps = {
  currentUser: AccountUser;
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

export default function AccountSettingsPage({
  currentUser,
}: AccountSettingsPageProps) {
  const router = useRouter();
  const canEditProfile = isAdminRole(currentUser.role);

  const [nama, setNama] = useState(currentUser.nama);
  const [jabatan, setJabatan] = useState(currentUser.jabatan || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEditProfile) {
      setMessage("Nama dan jabatan hanya dapat diubah oleh admin.");
      return;
    }

    setProfileLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nama,
          jabatan,
        }),
      });

      const data = await res.json();
      setMessage(data.message || "Profil berhasil diperbarui.");

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setMessage("Terjadi kesalahan saat memperbarui profil.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage("");

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await readApiResponse(res);
      const responseMessage = data.message || "Password berhasil diperbarui.";

      setPasswordMessage(responseMessage);

      if (!res.ok) {
        toast.error("Password gagal diperbarui", {
          description: responseMessage,
        });
        return;
      }

      toast.success("Password berhasil diperbarui", {
        description: responseMessage,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      const errorMessage = "Terjadi kesalahan saat memperbarui password.";

      setPasswordMessage(errorMessage);
      toast.error("Password gagal diperbarui", {
        description: errorMessage,
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Pengaturan Akun
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-5xl">
              Profil & Keamanan
            </h1>

            <p className="mt-3 max-w-2xl text-slate-600">
              {canEditProfile
                ? "Perbarui identitas yang tampil di dashboard dan ubah password akunmu."
                : "Lihat identitas akunmu dan ubah password. Nama dan jabatan dikelola oleh admin."}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                isAdminRole(currentUser.role)
                  ? "/dashboard/admin"
                  : "/dashboard/user",
              )
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
          >
            <ArrowLeft className="h-4 w-4 text-blue-600" />
            Kembali ke Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
                <UserRound className="h-6 w-6 text-blue-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900">Profil</h2>
                <p className="text-sm text-slate-500">
                  Data ini digunakan untuk identitas di dalam sistem.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">NIP Login</p>

              <p className="mt-1 font-semibold text-slate-900">
                {currentUser.nip || "-"}
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {currentUser.role}
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Nama
                </label>

                <input
                  value={nama}
                  onChange={(event) => setNama(event.target.value)}
                  required
                  disabled={!canEditProfile}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Jabatan
                </label>

                <input
                  value={jabatan}
                  onChange={(event) => setJabatan(event.target.value)}
                  placeholder="Contoh: Staff Operasional"
                  disabled={!canEditProfile}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {!canEditProfile ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Nama dan jabatan hanya dapat diperbarui oleh admin.
                </div>
              ) : null}

              {message ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  {message}
                </div>
              ) : null}

              {canEditProfile ? (
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />
                  {profileLoading ? "Menyimpan..." : "Simpan Profil"}
                </button>
              ) : null}
            </form>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
                <KeyRound className="h-6 w-6 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Keamanan
                </h2>
                <p className="text-sm text-slate-500">
                  Gunakan password baru yang kuat dan mudah diingat.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Password Saat Ini
                </label>

                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Password Baru
                </label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Konfirmasi Password Baru
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Password minimal 8 karakter dan harus mengandung huruf, angka,
                dan simbol.
              </div>

              {passwordMessage ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {passwordMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <KeyRound className="h-4 w-4" />
                {passwordLoading ? "Memperbarui..." : "Ubah Password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}