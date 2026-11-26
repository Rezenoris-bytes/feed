// Restores a backup made by scripts/backup.ts.
//   npm run restore -- --verify [backupDir]     restore into a throwaway database, compare everything, then drop it (safe, run regularly)
//   npm run restore -- --into-live <backupDir>  replace the live database and uploads (stop the app first!)
// With no backupDir the newest backup is used.
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { execSync } from "node:child_process";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BACKUP_DIR, open, sha256, type Manifest } from "./backup-lib";

// Parents before children so the restored data satisfies foreign keys.
const ORDER = [
  "roles", "permissions", "role_permissions", "departments", "users", "user_roles", "sessions", "employee_profiles",
  "feedback_categories", "feedback_priorities", "feedback_submissions", "feedback_identity_mappings", "feedback_attachments",
  "feedback_assignments", "feedback_status_history", "feedback_internal_notes", "feedback_messages", "notifications",
  "audit_logs", "identity_access_logs", "system_settings",
];

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
  const admin = new URL(base); admin.pathname = "/postgres";
  const targetUrl = new URL(base); targetUrl.pathname = "/" + target;

  // 1. Decrypt + checksum every table before touching anything.
  const data = new Map<string, Buffer>();
  for (const t of manifest.tables) {
    const buf = open(await readFile(path.join(dir, "tables", t.name + ".bin.enc")));
    if (sha256(buf) !== t.sha256) throw new Error(`Checksum mismatch in ${t.name}. Backup is corrupt`);
    data.set(t.name, buf);
  }
  console.log(`  ✓ ${data.size} tables decrypted and checksums match`);

  // 2. Fresh database with the same schema.
  const a = new Client({ connectionString: admin.toString() });
  await a.connect();
  await a.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [target]);
  await a.query(`DROP DATABASE IF EXISTS "${target}"`);
  await a.query(`CREATE DATABASE "${target}"`);
  await a.end();
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: targetUrl.toString() }, stdio: "pipe" });
  console.log("  ✓ schema migrated");

  // 3. Load data. replica mode skips triggers (append-only guards) during the bulk load only.
  const db = new Client({ connectionString: targetUrl.toString() });
  await db.connect();
  await db.query("BEGIN");
  await db.query("SET LOCAL session_replication_role = replica");
  const names = [...ORDER.filter((n) => data.has(n)), ...[...data.keys()].filter((n) => !ORDER.includes(n))];
  for (const n of names) await pipeline(Readable.from(data.get(n)!), db.query(copyFrom(`COPY "${n}" FROM STDIN WITH (FORMAT binary)`)));
  await db.query("COMMIT");

  // 4. Verify row counts.
  let ok = true;
  for (const t of manifest.tables) {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM "${t.name}"`);
    if (rows[0].n !== t.rows) { ok = false; console.error(`  ✗ ${t.name}: expected ${t.rows}, got ${rows[0].n}`); }
  }
  // Append-only triggers must be active again after restore.
  const trig = await db.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE '%append_only%' OR tgname = 'identity_mapping_immutable'");
  if (trig.rows[0].n < 3) { ok = false; console.error("  ✗ audit protection triggers missing"); }
  await db.end();
  if (!ok) throw new Error("Restore verification failed");
  console.log(`  ✓ row counts match for all ${manifest.tables.length} tables; audit protections intact`);

  // 5. Uploads
  for (const u of manifest.uploads) {
    const b = await readFile(path.join(dir, "uploads", u.name));
    if (sha256(b) !== u.sha256) throw new Error(`Checksum mismatch in upload ${u.name}`);
  }
  if (live) {
    const up = path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
    await mkdir(up, { recursive: true });
    for (const u of manifest.uploads) await copyFile(path.join(dir, "uploads", u.name), path.join(up, u.name));
    const brandDir = path.resolve(process.env.BRANDING_DIR ?? "./storage/branding");
    await mkdir(brandDir, { recursive: true });
    await copyFile(path.join(dir, "logo.png"), path.join(brandDir, "logo.png")).catch(() => {}); // only if the backup had one
  }
  console.log(`  ✓ ${manifest.uploads.length} uploaded files verified${live ? " and restored" : ""}`);

  if (!live) {
    const c = new Client({ connectionString: admin.toString() }); await c.connect();
    await c.query(`DROP DATABASE "${target}"`); await c.end();
    console.log("Restore test PASSED (test database removed).");
  } else console.log("Live restore complete.");
}
main().catch((e) => { console.error("Restore failed:", e.message); process.exitCode = 1; });
