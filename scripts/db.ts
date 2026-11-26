// Runs a local MySQL-compatible server (MySQL 8 or MariaDB) from an existing install, e.g. XAMPP. No Docker, no cloud.
// Data lives in ./storage/mysql, separate from any other databases on the machine.
// Usage: npm run db        (MYSQL_BIN_DIR defaults to C:\xampp\mysql\bin)
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import "dotenv/config";

const url = new URL(process.env.DATABASE_URL!);
if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must start with mysql://");
const port = Number(url.port || 3307);
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const database = url.pathname.slice(1);
const bin = process.env.MYSQL_BIN_DIR ?? "C:\\xampp\\mysql\\bin";
const exe = (n: string) => path.join(bin, process.platform === "win32" ? `${n}.exe` : n);
const dataDir = path.resolve("storage/mysql");

const version = execFileSync(exe("mysqld"), ["--version"]).toString();
const isMaria = /mariadb/i.test(version);

async function main() {
  const fresh = !existsSync(path.join(dataDir, "mysql"));
  if (fresh) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`Initialising ${isMaria ? "MariaDB" : "MySQL"} data directory…`);
    if (isMaria) execFileSync(exe("mysql_install_db"), [`--datadir=${dataDir}`], { stdio: "inherit" });
    else execFileSync(exe("mysqld"), ["--initialize-insecure", `--datadir=${dataDir}`, "--console"], { stdio: "inherit" });
  }

  const server = spawn(exe("mysqld"), [
    ...(isMaria ? ["--no-defaults"] : []), // ignore XAMPP's my.ini (it points at XAMPP's own data dir)
    `--datadir=${dataDir}`, `--port=${port}`, "--bind-address=127.0.0.1",
    "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci",
    "--default-time-zone=+00:00", "--sql-mode=STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO",
    ...(isMaria ? [] : ["--mysqlx=OFF"]),
  ], { stdio: ["ignore", "inherit", "inherit"] });

  // Wait until it accepts connections.
  let root: mysql.Connection | null = null;
  for (let i = 0; i < 60 && !root; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    root = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", password: fresh ? "" : process.env.MYSQL_ROOT_PASSWORD ?? "" }).catch(() => null);
    if (!root && !fresh) root = await mysql.createConnection({ host: "127.0.0.1", port, user, password }).catch(() => null);
  }
  if (!root) throw new Error("Database server did not start");

  if (fresh) {
    // App user can create databases (needed for migrations and the restore check). Root only from this machine.
    for (const host of ["localhost", "127.0.0.1"]) {
      await root.query(`CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?`, [user, host, password]);
      await root.query(`GRANT ALL PRIVILEGES ON *.* TO ?@? WITH GRANT OPTION`, [user, host]);
    }
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query("FLUSH PRIVILEGES");
  }
  await root.end();
  console.log(`${isMaria ? "MariaDB" : "MySQL"} running on 127.0.0.1:${port} (data: ${dataDir}). Ctrl+C to stop.`);

  const stop = () => { server.kill(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("exit", (code) => process.exit(code ?? 0));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
