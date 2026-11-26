// Seeds reference data (roles, permissions, categories, priorities, departments) and,
// only when no users exist, initial accounts with random passwords written to
// storage/initial-credentials.txt (git-ignored). Nothing is hardcoded.
import { PrismaClient, type RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import "dotenv/config";

const prisma = new PrismaClient();


import { ROLE_PERMISSIONS_SEED as RP } from "../src/server/rbac-data";

const CATEGORIES: [string, boolean][] = [
  ["General feedback", false], ["Workplace complaint", false], ["Management concern", false],
  ["HR concern", false], ["Salary & benefits", false], ["Work environment", false],
  ["Team conflict", false], ["Harassment or misconduct", true], ["Suggestion", false],
  ["Positive feedback", false], ["Other", false],
];
const PRIORITIES = [["LOW", "Low", 1], ["MEDIUM", "Medium", 2], ["HIGH", "High", 3], ["CRITICAL", "Critical", 4]] as const;
const DEPARTMENTS = ["Operations", "Sales", "Finance", "Engineering", "Warehouse", "Human Resources"];

async function main() {
  const allPerms = [...new Set(Object.values(RP).flat())];
  for (const key of allPerms) await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });

  const names: Record<RoleKey, string> = { SUPER_ADMIN: "Super Admin", HR: "HR Administrator", REVIEWER: "Department Reviewer", EMPLOYEE: "Employee" };
  for (const key of Object.keys(RP) as RoleKey[]) {
    const role = await prisma.role.upsert({ where: { key }, update: { name: names[key] }, create: { key, name: names[key] } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({ where: { key: { in: RP[key] } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }

  for (const [i, [name, sensitive]] of CATEGORIES.entries())
    await prisma.feedbackCategory.upsert({ where: { name }, update: {}, create: { name, sensitive, sortOrder: i } });
  for (const [key, name, rank] of PRIORITIES)
    await prisma.feedbackPriority.upsert({ where: { key }, update: {}, create: { key, name, rank } });
  for (const name of DEPARTMENTS) await prisma.department.upsert({ where: { name }, update: {}, create: { name } });

  // --reference-only (used during deploy builds): never create accounts, so no passwords end up in build logs or files.
  if (process.argv.includes("--reference-only")) return console.log("Reference data seeded (roles, permissions, categories, priorities, departments).");
  if ((await prisma.user.count()) > 0) return console.log("Reference data seeded. Users already exist, skipped accounts.");

  const ops = await prisma.department.findUniqueOrThrow({ where: { name: "Operations" } });
  const accounts: { email: string; name: string; role: RoleKey; emp?: string }[] = [
    { email: "superadmin@feed.local", name: "Super Admin", role: "SUPER_ADMIN" },
    { email: "hr@feed.local", name: "HR Administrator", role: "HR" },
    { email: "reviewer@feed.local", name: "Operations Reviewer", role: "REVIEWER" },
  ];
  const lines = ["# Initial accounts â€” change these passwords after first login, then delete this file.", ""];
  for (const a of accounts) {
    const password = randomBytes(12).toString("base64url");
    const role = await prisma.role.findUniqueOrThrow({ where: { key: a.role } });
    await prisma.user.create({
      data: {
        email: a.email, displayName: a.name, passwordHash: await bcrypt.hash(password, 12),
        departmentId: a.role === "REVIEWER" ? ops.id : null,
        roles: { create: { roleId: role.id } },
        profile: a.emp ? { create: { employeeNo: a.emp } } : undefined,
      },
    });
    lines.push(`${a.role.padEnd(12)} ${a.email}  ${password}`);
  }
  mkdirSync("storage", { recursive: true });
  writeFileSync("storage/initial-credentials.txt", lines.join("\n") + "\n", { mode: 0o600 });
  console.log("Seeded. Initial account passwords written to storage/initial-credentials.txt");
}

main().finally(() => prisma.$disconnect());
