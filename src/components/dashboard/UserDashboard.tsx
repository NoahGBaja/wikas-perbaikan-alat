import Image from "next/image";
import Link from "next/link";
import { CircleUserRound, ShieldCheck } from "lucide-react";
import UserDashboardLogoutButton from "./UserDashboardLogoutButton";
import { getRoleLabel } from "@/src/lib/roles";

type UserDashboardProps = {
  currentUser: {
    id: number;
    nama: string;
    jabatan: string | null;
    nip: string | null;
    role: "USER";
  };
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function UserDashboard({ currentUser }: UserDashboardProps) {
  const initials = getInitials(currentUser.nama) || "U";

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <Image
        src="/images/dashboard-user-bg.jpg"
        alt=""
        fill
        preload={true}
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-white/78" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_34%),linear-gradient(to_bottom,rgba(255,255,255,0.9),rgba(248,250,252,0.82),rgba(239,246,255,0.88))]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white/75 shadow-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Sistem Laporan Barang & Alat
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Portal internal pegawai
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-base font-bold text-blue-700 ring-1 ring-blue-100">
                  {initials}
                </div>

                <div className="min-w-[170px]">
                  <p className="text-sm font-semibold text-slate-900">
                    {currentUser.nama}
                  </p>

                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {getRoleLabel(currentUser.role)}
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">
                    NIP: {currentUser.nip || "-"}
                  </div>
                </div>

                <Link
                  href="/dashboard/account"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
                >
                  <CircleUserRound className="h-4 w-4" />
                  Akun
                </Link>

                <UserDashboardLogoutButton className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60" />
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-sm font-bold text-blue-700 shadow-sm md:hidden">
                {initials}
              </div>
            </div>
          </div>

          <div className="mx-auto hidden w-full max-w-7xl items-center gap-8 px-6 pb-4 md:flex">
            <Link
              href="/dashboard/user"
              className="font-medium text-blue-700 transition hover:text-blue-600"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/user/report"
              className="font-medium text-slate-600 transition hover:text-blue-600"
            >
              Buat Laporan
            </Link>
            <Link
              href="/dashboard/user/status"
              className="font-medium text-slate-600 transition hover:text-blue-600"
            >
              Status
            </Link>
            <Link
              href="/dashboard/account"
              className="font-medium text-slate-600 transition hover:text-blue-600"
            >
              Akun
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-3 px-6 pb-4 md:hidden">
            <Link
              href="/dashboard/user/report"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
            >
              Buat Laporan
            </Link>
            <Link
              href="/dashboard/user/status"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
            >
              Status
            </Link>
            <Link
              href="/dashboard/account"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
            >
              Akun
            </Link>
            <UserDashboardLogoutButton className="inline-flex items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-10 md:py-14">
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Dashboard Pegawai
            </p>

            <h2 className="max-w-4xl text-4xl font-extrabold leading-tight text-slate-950 md:text-6xl">
              Buat Laporan Kerusakan
              <span className="block text-blue-700">
                dengan Mudah dan Cepat
              </span>
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-xl">
              Portal internal yang membantu pegawai membuat laporan kerusakan
              barang, alat, dan fasilitas kantor dengan tampilan sederhana namun
              tetap profesional.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
