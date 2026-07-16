/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mariadb = require("mariadb");

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const parsed = new URL(process.env.DATABASE_URL);
  const conn = await mariadb.createConnection({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
    multipleStatements: false,
  });

  const sqlPath = path.join(process.cwd(), "scripts", "repair-local-schema.sql");
  const statements = splitSqlStatements(fs.readFileSync(sqlPath, "utf8"));

  try {
    for (const [index, statement] of statements.entries()) {
      try {
        await conn.query(statement);
      } catch (error) {
        const code = error?.code || error?.errno;
        const ignorable = [
          "ER_DUP_KEYNAME",
          "ER_DUP_FIELDNAME",
          "ER_TABLE_EXISTS_ERROR",
          "ER_CANT_DROP_FIELD_OR_KEY",
        ].includes(code);

        if (!ignorable) {
          console.error(`Failed at statement ${index + 1}:`);
          console.error(statement);
          throw error;
        }
      }
    }

    console.log(`Applied ${statements.length} repair statements.`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
