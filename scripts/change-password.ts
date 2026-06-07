import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { validatePasswordStrength } from "../src/lib/passwords";

async function main() {
  const nip = process.env.CHANGE_PASSWORD_NIP || process.argv[2] || "";
  const newPassword = process.env.CHANGE_PASSWORD_NEW || process.argv[3] || "";

  if (!nip || !newPassword) {
    throw new Error(
      "Gunakan: npm run change-password -- <nip> <password-baru> atau isi CHANGE_PASSWORD_NIP dan CHANGE_PASSWORD_NEW."
    );
  }

  const passwordErrors = validatePasswordStrength(newPassword);

  if (passwordErrors.length > 0) {
    throw new Error(passwordErrors[0]);
  }

  const user = await prisma.user.findUnique({
    where: { nip },
  });

  if (!user) {
    console.log(`User dengan NIP ${nip} tidak ditemukan`);
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
    },
  });

  console.log("Password berhasil diubah");
  console.log("NIP:", nip);
}

main()
  .catch((error) => {
    console.error("Gagal mengubah password:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
