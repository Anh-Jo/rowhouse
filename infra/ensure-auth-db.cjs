// Ensure the better-auth database exists before `prisma migrate deploy` runs
// against it. Managed Postgres services (Coolify, RDS…) usually provision a
// single database (the app database); the auth database lives in the same
// instance but has to be created once. `migrate deploy` never creates
// databases, and the instance may have no shell access, so the container
// provisions it itself — idempotent, safe on every boot. Mirrors
// infra/create-auth-db.sql, which only runs on a fresh dev volume.
const { Client } = require("pg");

async function main() {
  const authUrl = new URL(process.env.AUTH_DATABASE_URL);
  const dbName = decodeURIComponent(authUrl.pathname.slice(1));
  if (!dbName) throw new Error("AUTH_DATABASE_URL has no database name");

  // CREATE DATABASE cannot run against the target itself, so connect through
  // the app database (same instance) to issue it.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rowCount === 0) {
      // dbName comes from our own env; quote it as an identifier defensively.
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`[ensure-auth-db] created database "${dbName}"`);
    } else {
      console.log(`[ensure-auth-db] database "${dbName}" already exists`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[ensure-auth-db]", err.message);
  process.exit(1);
});
