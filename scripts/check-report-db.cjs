/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config();

const mariadb = require("mariadb");

async function main() {
  const parsed = new URL(process.env.DATABASE_URL);
  const conn = await mariadb.createConnection({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
  });

  try {
    const tableRows = await conn.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ReportApprovalHistory'
    `);

    const statusRows = await conn.query(`
      SELECT status, COUNT(*) AS count
      FROM Report
      GROUP BY status
      ORDER BY status
    `);

    const oldStatusRows = statusRows.filter((row) =>
      ["MENUNGGU", "DISETUJUI", "DIPROSES", "SELESAI"].includes(row.status)
    );
    const roleRows = await conn.query(`
      SELECT role, COUNT(*) AS count
      FROM User
      GROUP BY role
      ORDER BY role
    `);
    const oldRoleRows = roleRows.filter((row) => row.role === "ADMIN");

    console.log(
      `ReportApprovalHistory table: ${
        Number(tableRows[0]?.count || 0) > 0 ? "present" : "missing"
      }`
    );
    console.log(
      `Old report statuses: ${
        oldStatusRows.length > 0
          ? oldStatusRows
              .map((row) => `${row.status}=${row.count}`)
              .join(", ")
          : "none"
      }`
    );
    console.log(
      `Current report statuses: ${statusRows
        .map((row) => `${row.status}=${row.count}`)
        .join(", ")}`
    );
    console.log(
      `Old user roles: ${
        oldRoleRows.length > 0
          ? oldRoleRows.map((row) => `${row.role}=${row.count}`).join(", ")
          : "none"
      }`
    );
    console.log(
      `Current user roles: ${roleRows
        .map((row) => `${row.role}=${row.count}`)
        .join(", ")}`
    );
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
