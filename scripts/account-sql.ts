// Generates SQL to create staff accounts directly in a production database (e.g. via phpMyAdmin),
// for hosts without SSH. Passwords are random, shown only in a local git-ignored file, and stored as bcrypt hashes.
//
// Usage (one or more accounts):
//   npm run account-sql -- SUPER_ADMIN admin@company.com "Full Name"  HR hr@company.com "HR Person"
//   Roles: SUPER_ADMIN | HR | REVIEWER (REVIEWER needs a 4th value: the department name, e.g. "Operations")
//
// Output: storage/accounts.sql (paste into phpMyAdmin → SQL tab) and storage/accounts-credentials.txt (keep private, then delete).
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

type Acc = { role: "SUPER_ADMIN" | "HR" | "REVIEWER"; email: string; name: string; dept?: string };
const args = process.argv.slice(2);
const accounts: Acc[] = [];
for (let i = 0; i < args.length; ) {
  const role = args[i]?.toUpperCase() as Acc["role"];
  if (!["SUPER_ADMIN", "HR", "REVIEWER"].includes(role)) throw new Error(`Unknown role "${args[i]}". Use SUPER_ADMIN, HR or REVIEWER.`);
  const email = (args[i + 1] ?? "").trim().toLowerCase();
  const name = (args[i + 2] ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Invalid email for ${role}: "${args[i + 1] ?? ""}"`);
  if (name.length < 2) throw new Error(`Missing name for ${email}`);
  const dept = role === "REVIEWER" ? (args[i + 3] ?? "").trim() : undefined;
  if (role === "REVIEWER" && !dept) throw new Error(`REVIEWER ${email} needs a department name`);
  accounts.push({ role, email, name, dept });
  i += role === "REVIEWER" ? 4 : 3;
}
if (!accounts.length) throw new Error('Usage: npm run account-sql -- SUPER_ADMIN admin@company.com "Full Name" HR hr@company.com "HR Person"');

const q = (s: string) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
const sql: string[] = [
  "-- Feed: create staff accounts. Run once in phpMyAdmin (SQL tab) on the Feed database.",
  "-- Fails safely if an email already exists (unique) or the roles table is empty (run a deploy first).",
  "START TRANSACTION;",
];
const creds: string[] = ["# One-time passwords. Sign in, change them under My account / Security, then DELETE this file.", ""];

for (const a of accounts) {
  const id = randomUUID();
  const password = randomBytes(12).toString("base64url");
  const hash = bcrypt.hashSync(password, 12);
  const dept = a.dept ? `(SELECT id FROM departments WHERE name = ${q(a.dept)} LIMIT 1)` : "NULL";
  sql.push(
    "",
    `-- ${a.role}: ${a.email}`,
    `INSERT INTO users (id, email, passwordHash, displayName, isActive, mfaEnabled, failedLogins, departmentId, createdAt, updatedAt)`,
    `VALUES (${q(id)}, ${q(a.email)}, ${q(hash)}, ${q(a.name)}, 1, 0, 0, ${dept}, NOW(3), NOW(3));`,
    `INSERT INTO user_roles (userId, roleId) SELECT ${q(id)}, id FROM roles WHERE \`key\` = ${q(a.role)};`,
    `INSERT INTO audit_logs (id, actorId, action, target, createdAt) VALUES (${q(randomUUID())}, NULL, 'sql.account.create', ${q(id)}, NOW(3));`,
  );
  creds.push(`${a.role.padEnd(12)} ${a.email}  ${password}`);
}
sql.push(
  "",
  "-- Safety check: every new account must have exactly one role. If any shows 0, run ROLLBACK instead of COMMIT.",
  `SELECT u.email, COUNT(ur.roleId) AS roles FROM users u LEFT JOIN user_roles ur ON ur.userId = u.id WHERE u.email IN (${accounts.map((a) => q(a.email)).join(", ")}) GROUP BY u.email;`,
  "COMMIT;",
);

mkdirSync("storage", { recursive: true });
writeFileSync("storage/accounts.sql", sql.join("\n") + "\n");
writeFileSync("storage/accounts-credentials.txt", creds.join("\n") + "\n", { mode: 0o600 });
console.log(`Wrote storage/accounts.sql (${accounts.length} account${accounts.length > 1 ? "s" : ""}) and storage/accounts-credentials.txt`);
console.log("Paste accounts.sql into phpMyAdmin → SQL. Keep the credentials file private and delete it after first sign-in.");
