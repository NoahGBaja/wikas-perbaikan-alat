import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPool } from "mariadb";

const pool = createPool({
  host: "127.0.0.1",
  port: 3307,
  user: "root",
  password: "",
  database: "wikas_perbaikan_alat_v2",
  connectionLimit: 5,
});

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "admin12345";

const accounts = [
  {
    nama: "Super Admin Wikas",
    nip: "SUPER001",
    jabatan: "Super Admin",
    role: "SUPER_ADMIN",
    categoryScope: null,
  },
  {
    nama: "Admin 1 Wikas",
    nip: "ADMIN001",
    jabatan: "Admin Approval Level 1",
    role: "ADMIN_1",
    categoryScope: "FASILITAS_INVENTARIS",
  },
  {
    nama: "Admin 2 Wikas",
    nip: "ADMIN002",
    jabatan: "Admin Approval Level 2",
    role: "ADMIN_2",
    categoryScope: null,
  },
  {
    nama: "Admin 3 Wikas",
    nip: "ADMIN003",
    jabatan: "Admin Approval Level 3",
    role: "ADMIN_3",
    categoryScope: null,
  },
  {
    nama: "Admin 4 Wikas",
    nip: "ADMIN004",
    jabatan: "Admin Approval Level 4",
    role: "ADMIN_4",
    categoryScope: "FASILITAS_INVENTARIS",
  },
  {
    nama: "Admin 5 Wikas",
    nip: "ADMIN005",
    jabatan: "Admin Approval Level 5",
    role: "ADMIN_5",
    categoryScope: null,
  },
  {
    nama: "Admin 6 Wikas",
    nip: "ADMIN006",
    jabatan: "Admin Approval Level 6",
    role: "ADMIN_6",
    categoryScope: null,
  },
  {
    nama: "User Testing Wikas",
    nip: "USER001",
    jabatan: "User Testing",
    role: "USER",
    categoryScope: null,
  },
];

async function main() {
  const conn = await pool.getConnection();

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

    for (const account of accounts) {
      await conn.query(
        `
        INSERT INTO \`user\`
          (nama, nip, jabatan, role, categoryScope, passwordHash, createdAt, updatedAt)
        VALUES
          (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          nama = VALUES(nama),
          jabatan = VALUES(jabatan),
          role = VALUES(role),
          categoryScope = VALUES(categoryScope),
          passwordHash = VALUES(passwordHash),
          updatedAt = NOW(3)
        `,
        [
          account.nama,
          account.nip,
          account.jabatan,
          account.role,
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
