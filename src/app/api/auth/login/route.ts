import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { createSession } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { HttpError } from "@/server/rbac";
import { adminMfaRequired } from "@/server/mfa-policy";

const Body = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 12); // equalise timing for unknown emails
const GENERIC = "Email or password is incorrect";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const { email, password } = Body.parse(await req.json());
  const e = email.toLowerCase();
  if (!rateLimit("login:" + e, 5, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Try again later.");

  const user = await prisma.user.findUnique({ where: { email: e }, include: { roles: { include: { role: true } } } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  // Staff only. Employee accounts can't sign in (employees submit anonymously, without a login).
  const isStaff = !!user?.roles.some((r) => r.role.key !== "EMPLOYEE");
  if (!user || !user.isActive || user.deletedAt || !isStaff) throw new HttpError(401, GENERIC);
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpError(429, "Account temporarily locked. Try again later.");
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
    });
    throw new HttpError(401, GENERIC);
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  const isSuper = user.roles.some((r) => r.role.key === "SUPER_ADMIN");
  await createSession(user.id, false);
  await prisma.auditLog.create({ data: { actorId: user.id, action: "auth.login" } });

  const staff = user.roles.some((r) => r.role.key === "HR" || r.role.key === "REVIEWER");
  const mfa = isSuper && (await adminMfaRequired());
  const next = isSuper ? (mfa ? (user.mfaEnabled ? "/mfa" : "/mfa/setup") : "/admin") : staff ? "/hr" : "/login";
  return NextResponse.json({ next });
});

