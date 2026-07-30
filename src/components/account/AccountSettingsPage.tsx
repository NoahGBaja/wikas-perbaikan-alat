"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  KeyRound,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { AppRole } from "@/src/lib/roles";
import { getRoleLabel, hasAdminAccess } from "@/src/lib/roles";
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

type AccountUser = {
  id: number;
  nama: string;
  jabatan: string | null;
  nip: string | null;
  role: AppRole;
  isSuperAdmin: boolean;
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
      text.trim().slice(0, 180) || `Request gagal dengan status ${res.status}.`,
  };
}

export default function AccountSettingsPage({
  currentUser,
}: AccountSettingsPageProps) {
  const router = useRouter();
  const canEditProfile = hasAdminAccess(currentUser);

  const [nama, setNama] = useState(currentUser.nama);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMessageType, setPasswordMessageType] = useState<
    "success" | "error"
  >("success");

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEditProfile) {
      const text = "Nama hanya dapat diubah oleh admin.";
      setMessage(toFeedback(text, "error"));
      showError("Profil tidak dapat diubah", text);
      return;
    }

    setProfileLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nama,
          jabatan: currentUser.jabatan || "",
        }),
      });

      const data = await res.json();
      const responseMessage = data.message || "Profil berhasil diperbarui.";

      if (!res.ok) {
        setMessage(toFeedback(responseMessage, "error"));
        showError("Gagal memperbarui profil", responseMessage);
        return;
      }

      setMessage(toFeedback(responseMessage, "success"));
      showSuccess("Profil diperbarui", responseMessage);
      router.refresh();
    } catch (error) {
      console.error(error);
      const text = "Terjadi kesalahan saat memperbarui profil.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal memperbarui profil", text);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordMessageType("success");

    if (!currentPassword || !newPassword || !confirmPassword) {
      const errorMessage =
        "Kata sandi saat ini, kata sandi baru, dan konfirmasi wajib diisi.";

      setPasswordMessage(errorMessage);
      setPasswordMessageType("error");
      showError("Kata sandi gagal diperbarui", errorMessage);
      return;
    }

    if (newPassword !== confirmPassword) {
      const errorMessage = "Konfirmasi password baru tidak sama.";

      setPasswordMessage(errorMessage);
      setPasswordMessageType("error");
      showError("Kata sandi gagal diperbarui", errorMessage);
      return;
    }

    const passwordErrors = validatePasswordStrength(newPassword);

    if (passwordErrors.length > 0) {
      setPasswordMessage(passwordErrors[0]);
      setPasswordMessageType("error");
      showError("Kata sandi gagal diperbarui", passwordErrors[0]);
      return;
    }

    setPasswordLoading(true);

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
      const responseMessage = data.message || "Kata sandi berhasil diperbarui.";

      setPasswordMessage(responseMessage);

      if (!res.ok) {
        setPasswordMessageType("error");
        showError("Kata sandi gagal diperbarui", responseMessage);
        return;
      }

      setPasswordMessageType("success");
      showSuccess("Kata sandi berhasil diperbarui", responseMessage);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      const errorMessage = "Terjadi kesalahan saat memperbarui kata sandi.";

      setPasswordMessage(errorMessage);
      setPasswordMessageType("error");
      showError("Kata sandi gagal diperbarui", errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Pengaturan Akun
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-5xl">
              Profil & Keamanan
            </h1>

            <p className="mt-3 max-w-2xl text-slate-600">
              {canEditProfile
                ? "Perbarui identitas yang tampil di dasbor dan ubah kata sandi akunmu."
                : "Lihat identitas akunmu dan ubah kata sandi. Nama dikelola oleh admin."}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  hasAdminAccess(currentUser)
                    ? "/dashboard/admin"
                    : "/dashboard/user",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4 text-blue-600" />
              Kembali ke Dasbor
            </button>
          </div>
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
              <p className="text-sm text-slate-500">NIP Masuk</p>

              <p className="mt-1 font-semibold text-slate-900">
                {currentUser.nip || "-"}
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {getRoleLabel(currentUser.role)}
                {currentUser.isSuperAdmin ? " + Admin Utama" : ""}
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

              {!canEditProfile ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Nama hanya dapat diperbarui oleh admin.
                </div>
              ) : null}

              <FeedbackBanner message={message} />

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
                <h2 className="text-2xl font-bold text-slate-900">Keamanan</h2>
                <p className="text-sm text-slate-500">
                  Gunakan kata sandi baru yang kuat dan mudah diingat.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Kata Sandi Saat Ini
                </label>

                <PasswordInput
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Kata Sandi Baru
                </label>

                <PasswordInput
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  minLength={8}
                  pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
                  title={PASSWORD_REQUIREMENT_TEXT}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Konfirmasi Kata Sandi Baru
                </label>

                <PasswordInput
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                  pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
                  title={PASSWORD_REQUIREMENT_TEXT}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {PASSWORD_REQUIREMENT_TEXT}
              </div>

              {passwordMessage ? (
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm",
                    passwordMessageType === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-100 bg-emerald-50 text-emerald-800",
                  ].join(" ")}
                >
                  {passwordMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <KeyRound className="h-4 w-4" />
                {passwordLoading ? "Memperbarui..." : "Ubah Kata Sandi"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
