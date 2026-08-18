"use client";

import { FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { showError, showSuccess } from "@/src/components/ui/feedback";

const ParticlesBackground = dynamic(
  () => import("@/components/particleBackground"),
  { ssr: false },
);

export default function LoginPageClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const nip = String(formData.get("nip") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!nip || !password) {
      showError("Masuk gagal", "NIP dan kata sandi wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nip,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(
          "Masuk gagal",
          data?.message || "Periksa kembali NIP dan kata sandi Anda.",
        );
        setLoading(false);
        return;
      }

      const redirectTo =
        data?.redirectTo ||
        (data?.user?.role === "USER" ? "/dashboard/user" : "/dashboard/admin");

      showSuccess("Masuk berhasil", "Anda akan diarahkan ke dasbor.");
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      console.error(err);
      showError(
        "Terjadi kesalahan saat masuk",
        "Silakan coba lagi dalam beberapa saat.",
      );
      setLoading(false);
    }
  }

  function handleForgotPasswordClick() {
    toast("Hubungi admin");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#004282] px-4 py-10">
      <div className="absolute inset-0 z-0 bg-[#004282]" />
      <ParticlesBackground className="z-10 opacity-100" />
      <div className="absolute inset-0 z-10 bg-[#004282]/20" />

      <section className="relative z-20 w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <Image
            src="/images/logo.png"
            alt="Logo Lembar Kerja Perbaikan Alat"
            width={120}
            height={120}
            className="h-24 w-auto"
            priority
          />

          <h1 className="mt-5 text-2xl font-semibold text-slate-900">
            Masuk ke akun Anda
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sistem internal Lembar Kerja Perbaikan Alat
          </p>
        </div>

        <form
          method="post"
          action="/api/login"
          onSubmit={handleSubmit}
          className="px-6 pb-6"
        >
          <div className="space-y-5">
            <div className="grid gap-2">
              <label
                htmlFor="nip"
                className="text-sm font-medium text-slate-700"
              >
                NIP
              </label>
              <input
                id="nip"
                name="nip"
                type="text"
                autoComplete="username"
                placeholder="Masukkan NIP"
                required
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#004282] focus:ring-2 focus:ring-[#004282]/15"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Kata Sandi
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Masukkan kata sandi"
                required
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#004282] focus:ring-2 focus:ring-[#004282]/15"
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={handleForgotPasswordClick}
                className="font-medium text-[#004282] transition hover:text-[#00386f]"
              >
                Lupa kata sandi?
              </button>

              <p className="text-slate-500">
                Butuh bantuan akses? Hubungi admin.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-[#004282] text-sm font-semibold text-white transition hover:bg-[#004282]/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
