import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { validatePasswordStrength } from "../src/lib/passwords";

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;

  if (!seedPassword) {
    throw new Error("Isi SEED_PASSWORD untuk menjalankan seed akun.");
  }

  const passwordErrors = validatePasswordStrength(seedPassword);

  if (passwordErrors.length > 0) {
    throw new Error(passwordErrors[0]);
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const users = [
    {
      nama: "Admin Utama",
      jabatan: "Kepala Administrasi",
      nip: "198501010000000001",
      role: "ADMIN",
    },
    {
      nama: "Admin Operasional",
      jabatan: "Koordinator Operasional",
      nip: "198501010000000002",
      role: "ADMIN",
    },
    {
      nama: "Admin Monitoring",
      jabatan: "Analis Monitoring",
      nip: "198501010000000003",
      role: "ADMIN",
    },
    {
      nama: "Admin Super",
      jabatan: "Administrator Sistem",
      nip: "198501010000000004",
      role: "ADMIN",
    },
    {
      nama: "User Biasa",
      jabatan: "Staff Umum",
      nip: "198501010000000005",
      role: "USER",
    },
  ] as const;

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        activeNip: user.nip,
      },
      update: {
        nama: user.nama,
        jabatan: user.jabatan,
        nip: user.nip,
        activeNip: user.nip,
        deletedAt: null,
        role: user.role,
        passwordHash,
      },
      create: {
        nama: user.nama,
        jabatan: user.jabatan,
        nip: user.nip,
        activeNip: user.nip,
        role: user.role,
        passwordHash,
      },
    });
  }

  console.log("Seed berhasil dijalankan.");
  console.log("Akun seed dibuat dengan password dari SEED_PASSWORD.");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
