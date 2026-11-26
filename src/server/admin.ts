import "server-only";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { can, HttpError, notFound, type Permission } from "./rbac";
import type { AuthContext } from "./session";

const tempPassword = () => randomBytes(12).toString("base64url");
const uuid = z.string().uuid();
const optUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));

// Roles assignable from the UI. SUPER_ADMIN can only be created from the server CLI, so no UI path can mint one.
const AssignableRole = z.enum(["HR", "REVIEWER"]); // employees have no accounts

export const AdminAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("user.create"), email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(2).max(100),
    role: AssignableRole, departmentId: optUuid }),
  z.object({ action: z.literal("user.update"), id: uuid, name: z.string().trim().min(2).max(100), departmentId: optUuid, jobTitle: z.string().trim().max(100).optional() }),
  z.object({ action: z.literal("user.active"), id: uuid, active: z.boolean() }),
  z.object({ action: z.literal("user.resetPassword"), id: uuid }),
  z.object({ action: z.literal("dept.create"), name: z.string().trim().min(2).max(80) }),
  z.object({ action: z.literal("dept.update"), id: uuid, name: z.string().trim().min(2).max(80).optional(), active: z.boolean().optional() }),
  z.object({ action: z.literal("category.create"), name: z.string().trim().min(2).max(80), sensitive: z.boolean() }),
  z.object({ action: z.literal("category.update"), id: uuid, name: z.string().trim().min(2).max(80).optional(), active: z.boolean().optional(), sensitive: z.boolean().optional() }),
  z.object({ action: z.literal("settings.set"), key: z.enum(["company", "notifications", "anonymous"]), value: z.unknown() }),
]);
type Action = z.infer<typeof AdminAction>;

const PERM: Record<Action["action"], Permission> = {
  "user.create": "admin.users", "user.update": "admin.users", "user.active": "admin.users", "user.resetPassword": "admin.users",
  "dept.create": "admin.departments", "dept.update": "admin.departments",
  "category.create": "admin.categories", "category.update": "admin.categories",
  "settings.set": "admin.settings",
};

export const SettingsSchema = {
  company: z.object({ name: z.string().trim().min(1).max(80), supportText: z.string().trim().max(300).default("") }),
  notifications: z.object({ newFeedback: z.boolean(), highPriority: z.boolean(), escalation: z.boolean(), assignment: z.boolean(), messages: z.boolean() }),
  anonymous: z.object({
    // Optional shared code printed on notice boards; stops random internet visitors. Empty = no code.
    accessCode: z.string().trim().toUpperCase().max(40).regex(/^[A-Z0-9-]*$/, "Letters, numbers and dashes only").default(""),
    hourlyLimit: z.number().int().min(1).max(1000).default(30),
  }),
};
export const SETTINGS_DEFAULTS = {
  company: { name: "Feed", supportText: "" },
  notifications: { newFeedback: true, highPriority: true, escalation: true, assignment: true, messages: true },
  anonymous: { accessCode: "", hourlyLimit: 30 },
};

export async function getSetting<K extends keyof typeof SETTINGS_DEFAULTS>(key: K): Promise<(typeof SETTINGS_DEFAULTS)[K]> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const parsed = SettingsSchema[key].safeParse(row?.value);
  return (parsed.success ? parsed.data : SETTINGS_DEFAULTS[key]) as (typeof SETTINGS_DEFAULTS)[K];
}

/** Returns { tempPassword } for create/reset so the admin can hand it over once; it is never stored in plain text. */
export async function runAdminAction(auth: AuthContext, a: Action): Promise<{ tempPassword?: string }> {
  if (!can(auth.roles, PERM[a.action])) throw notFound();
  const audit = (target?: string, meta?: Prisma.InputJsonValue) => prisma.auditLog.create({ data: { actorId: auth.userId, action: "admin." + a.action, target, meta } });

  try {
    switch (a.action) {
      case "user.create": {
        const pw = tempPassword();
        const role = await prisma.role.findUniqueOrThrow({ where: { key: a.role } });
        const u = await prisma.user.create({
          data: {
            email: a.email, displayName: a.name, passwordHash: await bcrypt.hash(pw, 12), departmentId: a.departmentId ?? null,
            roles: { create: { roleId: role.id } },
          },
        });
        await audit(u.id, { role: a.role });
        return { tempPassword: pw };
      }
      case "user.update": {
        await assertNotSuper(a.id);
        await prisma.user.update({ where: { id: a.id }, data: { displayName: a.name, departmentId: a.departmentId ?? null } });
        if (a.jobTitle !== undefined) await prisma.employeeProfile.updateMany({ where: { userId: a.id }, data: { jobTitle: a.jobTitle || null } });
        await audit(a.id);
        return {};
      }
      case "user.active": {
        await assertNotSuper(a.id);
        await prisma.$transaction([
          prisma.user.update({ where: { id: a.id }, data: { isActive: a.active } }),
          ...(a.active ? [] : [prisma.session.deleteMany({ where: { userId: a.id } }), prisma.feedbackAssignment.updateMany({ where: { assigneeId: a.id, active: true }, data: { active: false } })]),
        ]);
        await audit(a.id, { active: a.active });
        return {};
      }
      case "user.resetPassword": {
        await assertNotSuper(a.id);
        const pw = tempPassword();
        await prisma.$transaction([
          prisma.user.update({ where: { id: a.id }, data: { passwordHash: await bcrypt.hash(pw, 12), failedLogins: 0, lockedUntil: null } }),
          prisma.session.deleteMany({ where: { userId: a.id } }),
        ]);
        await audit(a.id);
        return { tempPassword: pw };
      }
      case "dept.create": { const d = await prisma.department.create({ data: { name: a.name } }); await audit(d.id); return {}; }
      case "dept.update": { await prisma.department.update({ where: { id: a.id }, data: { name: a.name, isActive: a.active } }); await audit(a.id, { name: a.name ?? null, active: a.active ?? null }); return {}; }
      case "category.create": {
        const max = await prisma.feedbackCategory.aggregate({ _max: { sortOrder: true } });
        const c = await prisma.feedbackCategory.create({ data: { name: a.name, sensitive: a.sensitive, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
        await audit(c.id); return {};
      }
      case "category.update": {
        await prisma.feedbackCategory.update({ where: { id: a.id }, data: { name: a.name, isActive: a.active, sensitive: a.sensitive } });
        await audit(a.id, { active: a.active ?? null, sensitive: a.sensitive ?? null }); return {};
      }
      case "settings.set": {
        const value = SettingsSchema[a.key].parse(a.value);
        await prisma.systemSetting.upsert({ where: { key: a.key }, update: { value }, create: { key: a.key, value } });
        await audit(a.key); return {};
      }
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "That name, email or employee number is already in use");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw notFound();
    throw e;
  }
}

/** Super Admin accounts can't be edited, disabled or reset from the UI (prevents lockout and takeover via a stolen session). */
async function assertNotSuper(id: string) {
  const isSuper = await prisma.userRole.findFirst({ where: { userId: id, role: { key: "SUPER_ADMIN" } } });
  if (isSuper) throw new HttpError(403, "Super Admin accounts are managed from the server command line");
}
