// Runs a real PostgreSQL server from node_modules (no Docker, no cloud).
// Data lives in ./storage/postgres. Usage: npm run db
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import "dotenv/config";

const url = new URL(process.env.DATABASE_URL!);
const dataDir = path.resolve("storage/postgres");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--auth=scram-sha-256"],
});

async function main() {
  const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase(url.pathname.slice(1));
  console.log(`PostgreSQL running on 127.0.0.1:${url.port} (data: ${dataDir}). Ctrl+C to stop.`);
  const stop = async () => { await pg.stop(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((e) => { console.error(e); process.exit(1); });
