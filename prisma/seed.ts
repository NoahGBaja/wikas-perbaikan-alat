import "dotenv/config";
import { createPool } from "mariadb";
import {
  hashPassword,
  validatePasswordStrength,
} from "../src/lib/passwords";

const pool = createPool({
  host: "127.0.0.1",
  port: 3307,
  user: "root",
  password: "",
  database: "wikas_perbaikan_alat_v2",
  connectionLimit: 5,
});

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "";

const accounts = [
  {
    nama: "Super Admin Wikas",
    nip: "SUPER001",
    jabatan: "Super Admin",
    role: "ADMIN_1",
    isSuperAdmin: true,
    categoryScope: "FASILITAS_INVENTARIS",
  },
  {
    nama: "Admin 1 Wikas",
    nip: "ADMIN001",
    jabatan: "Admin Approval Level 1",
    role: "ADMIN_1",
    isSuperAdmin: false,
    categoryScope: "FASILITAS_INVENTARIS",
  },
  {
    nama: "Admin 2 Wikas",
    nip: "ADMIN002",
    jabatan: "Admin Approval Level 2",
    role: "ADMIN_2",
    isSuperAdmin: false,
    categoryScope: null,
  },
  {
    nama: "Admin 3 Wikas",
    nip: "ADMIN003",
    jabatan: "Admin Approval Level 3",
    role: "ADMIN_3",
    isSuperAdmin: false,
    categoryScope: null,
  },
  {
    nama: "Admin 4 Wikas",
    nip: "ADMIN004",
    jabatan: "Admin Approval Level 4",
    role: "ADMIN_4",
    isSuperAdmin: false,
    categoryScope: "FASILITAS_INVENTARIS",
  },
  {
    nama: "Admin 5 Wikas",
    nip: "ADMIN005",
    jabatan: "Admin Approval Level 5",
    role: "ADMIN_5",
    isSuperAdmin: false,
    categoryScope: null,
  },
  {
    nama: "User Testing Wikas",
    nip: "USER001",
    jabatan: "User Testing",
    role: "USER",
    isSuperAdmin: false,
    categoryScope: null,
  },
];

async function main() {
  if (!DEFAULT_PASSWORD) {
    throw new Error("SEED_PASSWORD wajib diisi.");
  }

  const passwordErrors = validatePasswordStrength(DEFAULT_PASSWORD);

  if (passwordErrors.length > 0) {
    throw new Error(passwordErrors[0]);
  }

  const conn = await pool.getConnection();

  try {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    for (const account of accounts) {
      await conn.query(
        `
        INSERT INTO \`user\`
          (nama, nip, jabatan, role, isSuperAdmin, categoryScope, passwordHash, createdAt, updatedAt)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          nama = VALUES(nama),
          jabatan = VALUES(jabatan),
          role = VALUES(role),
          isSuperAdmin = VALUES(isSuperAdmin),
          categoryScope = VALUES(categoryScope),
          passwordHash = VALUES(passwordHash),
          updatedAt = NOW(3)
        `,
        [
          account.nama,
          account.nip,
          account.jabatan,
          account.role,
          account.isSuperAdmin,
          account.categoryScope,
          passwordHash,
        ]
      );

      console.log(`✅ ${account.role} dibuat/diupdate: ${account.nip}`);
    }

    console.log("");
    console.log("✅ Seed selesai.");
    console.log(`Password semua akun: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    console.error("❌ Seed error:", error);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(() => {
  process.exit(1);
});
