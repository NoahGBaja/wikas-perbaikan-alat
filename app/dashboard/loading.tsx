export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div
          aria-hidden="true"
          className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
        />
        <h1 className="mt-5 text-lg font-bold">Memuat halaman...</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Jika proses terlalu lama, kembali ke dasbor untuk memulai ulang
          navigasi.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Kembali ke Dasbor
        </a>
      </section>
    </main>
  );
}
