// Logical, encrypted backup of the MySQL database + uploaded files.
// Usage: npm run backup            (keeps the newest BACKUP_KEEP backups, default 14)
import mysql from "mysql2/promise";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { BACKUP_DIR, seal, sha256, type Manifest } from "./backup-lib";
import { storageDir } from "../src/lib/storage-dir";

/** Every value comes back exactly as MySQL stores it (as text), so a restore reproduces it byte for byte. */
export const asText: mysql.TypeCast = (field) => field.string();

async function main() {
  const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, typeCast: asText, dateStrings: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve(BACKUP_DIR, stamp);
  await mkdir(path.join(dir, "tables"), { recursive: true });
  await mkdir(path.join(dir, "uploads"), { recursive: true });

  // Consistent snapshot across all tables.
  await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await db.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
  const [tables] = await db.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> '_prisma_migrations' ORDER BY TABLE_NAME");
  const [migs] = await db.query<mysql.RowDataPacket[]>(
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name");

  const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), migrations: migs.map((m) => m.migration_name), tables: [], uploads: [] };
  for (const { name } of tables) {
    const [rows, fields] = await db.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${name}\``);
    const data = Buffer.from(JSON.stringify({ columns: fields.map((f) => f.name), rows: rows.map((r) => fields.map((f) => r[f.name])) }));
    await writeFile(path.join(dir, "tables", name + ".json.enc"), seal(data));
    manifest.tables.push({ name, rows: rows.length, sha256: sha256(data) });
  }
  await db.query("COMMIT");
  await db.end();

  // Attachments are already encrypted on disk; copy as-is.
  const uploadDir = storageDir("uploads", process.env.UPLOAD_DIR);
  for (const f of await readdir(uploadDir).catch(() => [] as string[])) {
    await copyFile(path.join(uploadDir, f), path.join(dir, "uploads", f));
    manifest.uploads.push({ name: f, sha256: sha256(await readFile(path.join(uploadDir, f))) });
  }
  // Company logo (not sensitive; copied as-is).
  const logo = path.join(storageDir("branding", process.env.BRANDING_DIR), "logo.png");
  await copyFile(logo, path.join(dir, "logo.png")).catch(() => {});
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Retention
  const keep = Number(process.env.BACKUP_KEEP ?? 14);
  const all = (await readdir(path.resolve(BACKUP_DIR))).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) await rm(path.resolve(BACKUP_DIR, old), { recursive: true, force: true });

  const total = manifest.tables.reduce((a, t) => a + t.rows, 0);
  console.log(`Backup written: ${dir}\n  ${manifest.tables.length} tables, ${total} rows, ${manifest.uploads.length} files`);
}
main().catch((e) => { console.error("Backup failed:", e.message); process.exitCode = 1; });
