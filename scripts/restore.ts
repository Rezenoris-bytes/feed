// Restores a backup made by scripts/backup.ts (MySQL / MariaDB).
//   npm run restore -- --verify [backupDir]     restore into a throwaway database, compare everything, then drop it (safe, run regularly)
//   npm run restore -- --into-live <backupDir>  replace the live database and uploads (stop the app first!)
// With no backupDir the newest backup is used.
import mysql from "mysql2/promise";
import { execSync } from "node:child_process";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { BACKUP_DIR, open, sha256, type Manifest } from "./backup-lib";
import { storageDir } from "../src/lib/storage-dir";

type TableDump = { columns: string[]; rows: (string | null)[][] };

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--into-live");
  if (!live && !args.includes("--verify")) throw new Error("Pass --verify or --into-live");
  const named = args.find((a) => !a.startsWith("--"));
  const dir = named ? path.resolve(named) : path.resolve(BACKUP_DIR, (await readdir(path.resolve(BACKUP_DIR))).sort().at(-1) ?? "");
  const manifest: Manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
  console.log(`Using backup ${path.basename(dir)} (${manifest.createdAt})`);

  const base = new URL(process.env.DATABASE_URL!);
  const liveDb = base.pathname.slice(1);
  const target = live ? liveDb : `${liveDb}_restore_test`;
  const targetUrl = new URL(base); targetUrl.pathname = "/" + target;
  const serverUrl = new URL(base); serverUrl.pathname = "/";

  // 1. Decrypt + checksum every table before touching anything.
  const data = new Map<string, TableDump>();
  for (const t of manifest.tables) {
    const buf = open(await readFile(path.join(dir, "tables", t.name + ".json.enc")));
    if (sha256(buf) !== t.sha256) throw new Error(`Checksum mismatch in ${t.name}. Backup is corrupt`);
    data.set(t.name, JSON.parse(buf.toString("utf8")));
  }
  console.log(`  ✓ ${data.size} tables decrypted and checksums match`);

  // 2. Fresh database with the same schema (migrations include the protection triggers).
  const admin = await mysql.createConnection({ uri: serverUrl.toString() });
  await admin.query(`DROP DATABASE IF EXISTS \`${target}\``);
  await admin.query(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: targetUrl.toString() }, stdio: "pipe" });
  console.log("  ✓ schema migrated");

  // 3. Load data. FK checks off during the bulk load only (parents and children arrive in any order).
  const db = await mysql.createConnection({ uri: targetUrl.toString(), dateStrings: true });
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  await db.beginTransaction();
  for (const [name, dump] of data) {
    const cols = dump.columns.map((c) => `\`${c}\``).join(", ");
    for (let i = 0; i < dump.rows.length; i += 500) {
      await db.query(`INSERT INTO \`${name}\` (${cols}) VALUES ?`, [dump.rows.slice(i, i + 500)]);
    }
  }
  await db.commit();
  await db.query("SET FOREIGN_KEY_CHECKS = 1");

  // 4. Verify row counts and that the protection triggers exist.
  let ok = true;
  for (const t of manifest.tables) {
    const [[r]] = await db.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${t.name}\``);
    if (Number(r.n) !== t.rows) { ok = false; console.error(`  ✗ ${t.name}: expected ${t.rows}, got ${r.n}`); }
  }
  const [[trig]] = await db.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()");
  if (Number(trig.n) < 7) { ok = false; console.error("  ✗ audit protection triggers missing"); }
  await db.end();
  if (!ok) throw new Error("Restore verification failed");
  console.log(`  ✓ row counts match for all ${manifest.tables.length} tables; ${trig.n} protection triggers in place`);

  // 5. Uploads
  for (const u of manifest.uploads) {
    const b = await readFile(path.join(dir, "uploads", u.name));
    if (sha256(b) !== u.sha256) throw new Error(`Checksum mismatch in upload ${u.name}`);
  }
  if (live) {
    const up = storageDir("uploads", process.env.UPLOAD_DIR);
    await mkdir(up, { recursive: true });
    for (const u of manifest.uploads) await copyFile(path.join(dir, "uploads", u.name), path.join(up, u.name));
    const brandDir = storageDir("branding", process.env.BRANDING_DIR);
    await mkdir(brandDir, { recursive: true });
    await copyFile(path.join(dir, "logo.png"), path.join(brandDir, "logo.png")).catch(() => {}); // only if the backup had one
  }
  console.log(`  ✓ ${manifest.uploads.length} uploaded files verified${live ? " and restored" : ""}`);

  if (!live) {
    const c = await mysql.createConnection({ uri: serverUrl.toString() });
    await c.query(`DROP DATABASE \`${target}\``); await c.end();
    console.log("Restore test PASSED (test database removed).");
  } else console.log("Live restore complete.");
}
main().catch((e) => { console.error("Restore failed:", e.message); process.exitCode = 1; });
