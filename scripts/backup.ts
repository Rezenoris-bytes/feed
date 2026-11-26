// Logical, encrypted backup of the database + uploaded files.
// Usage: npm run backup            (keeps the newest BACKUP_KEEP backups, default 14)
import { Client } from "pg";
import { to as copyTo } from "pg-copy-streams";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { BACKUP_DIR, seal, sha256, type Manifest } from "./backup-lib";

async function dumpTable(db: Client, table: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = db.query(copyTo(`COPY "${table}" TO STDOUT WITH (FORMAT binary)`));
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve(BACKUP_DIR, stamp);
  await mkdir(path.join(dir, "tables"), { recursive: true });
  await mkdir(path.join(dir, "uploads"), { recursive: true });

  // Consistent snapshot across all tables.
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows: tables } = await db.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
  const { rows: migs } = await db.query<{ migration_name: string }>(
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name");

  const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), migrations: migs.map((m) => m.migration_name), tables: [], uploads: [] };
  for (const { tablename } of tables) {
    const data = await dumpTable(db, tablename);
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "${tablename}"`);
    await writeFile(path.join(dir, "tables", tablename + ".bin.enc"), seal(data));
    manifest.tables.push({ name: tablename, rows: rows[0].n, sha256: sha256(data) });
  }
  await db.query("COMMIT");
  await db.end();

  // Attachments are already encrypted on disk; copy as-is.
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
  for (const f of await readdir(uploadDir).catch(() => [] as string[])) {
    await copyFile(path.join(uploadDir, f), path.join(dir, "uploads", f));
    manifest.uploads.push({ name: f, sha256: sha256(await readFile(path.join(uploadDir, f))) });
  }
  // Company logo (not sensitive; copied as-is).
  const logo = path.resolve(process.env.BRANDING_DIR ?? "./storage/branding", "logo.png");
  await copyFile(logo, path.join(dir, "logo.png")).catch(() => {});
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Retention
  const keep = Number(process.env.BACKUP_KEEP ?? 14);
  const all = (await readdir(path.resolve(BACKUP_DIR))).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) await rm(path.resolve(BACKUP_DIR, old), { recursive: true, force: true });

  const rows = manifest.tables.reduce((a, t) => a + t.rows, 0);
  console.log(`Backup written: ${dir}\n  ${manifest.tables.length} tables, ${rows} rows, ${manifest.uploads.length} files`);
}
main().catch((e) => { console.error("Backup failed:", e.message); process.exitCode = 1; });
