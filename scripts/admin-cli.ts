// Server-side Super Admin management. The web UI deliberately cannot create, disable or reset Super Admins.
// Usage:
//   npm run admin -- create <email> "<Full name>"     → prints a one-time temporary password
//   npm run admin -- reset-password <email>           → new temporary password, signs out everywhere
//   npm run admin -- reset-mfa <email>                → forces authenticator re-enrolment at next sign-in
//   npm run admin -- disable <email> | enable <email>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import "dotenv/config";

const prisma = new PrismaClient();
const [cmd, emailArg, name] = process.argv.slice(2);
const email = emailArg?.toLowerCase();
const temp = () => randomBytes(12).toString("base64url");

async function superUser() {
  const u = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  if (!u || !u.roles.some((r) => r.role.key === "SUPER_ADMIN")) throw new Error("No Super Admin with that email");
  return u;
}
const log = (action: string, target: string) => prisma.auditLog.create({ data: { action: "cli." + action, target } });

async function main() {
  if (!cmd || !email) throw new Error("Usage: npm run admin -- <create|reset-password|reset-mfa|disable|enable> <email> [name]");
  switch (cmd) {
    case "create": {
      if (!name) throw new Error('Name required: npm run admin -- create <email> "<Full name>"');
      const pw = temp();
      const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
      const u = await prisma.user.create({ data: { email, displayName: name, passwordHash: await bcrypt.hash(pw, 12), roles: { create: { roleId: role.id } } } });
      await log("superadmin.create", u.id);
      console.log(`Created. Temporary password (shown once): ${pw}`);
      break;
    }
    case "reset-password": {
      const u = await superUser(); const pw = temp();
      await prisma.$transaction([
        prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(pw, 12), failedLogins: 0, lockedUntil: null } }),
        prisma.session.deleteMany({ where: { userId: u.id } }),
      ]);
      await log("superadmin.resetPassword", u.id);
      console.log(`Password reset. Temporary password (shown once): ${pw}`);
      break;
    }
    case "reset-mfa": {
      const u = await superUser();
      await prisma.$transaction([
        prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: false, mfaSecretEnc: null } }),
        prisma.session.deleteMany({ where: { userId: u.id } }),
      ]);
      await log("superadmin.resetMfa", u.id);
      console.log("Authenticator removed. They will set up a new one at next sign-in.");
      break;
    }
    case "disable":
    case "enable": {
      const u = await superUser();
      if (cmd === "disable" && (await prisma.user.count({ where: { isActive: true, roles: { some: { role: { key: "SUPER_ADMIN" } } } } })) <= 1)
        throw new Error("Refusing to disable the last active Super Admin");
      await prisma.user.update({ where: { id: u.id }, data: { isActive: cmd === "enable" } });
      if (cmd === "disable") await prisma.session.deleteMany({ where: { userId: u.id } });
      await log("superadmin." + cmd, u.id);
      console.log(`${cmd === "enable" ? "Enabled" : "Disabled"}.`);
      break;
    }
    default: throw new Error("Unknown command " + cmd);
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
