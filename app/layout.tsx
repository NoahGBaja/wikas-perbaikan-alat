import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import NavigationRecovery from "@/src/components/navigation/NavigationRecovery";

export const metadata: Metadata = {
  title: "Lembar Kerja Perbaikan Alat",
  description:
    "Sistem internal untuk pelaporan, tindak lanjut, dan pemantauan perbaikan barang serta alat kantor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn("h-full antialiased", "font-sans")}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <NavigationRecovery />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
