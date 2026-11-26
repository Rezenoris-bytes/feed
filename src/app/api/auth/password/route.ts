import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { HttpError } from "@/server/rbac";

const Body = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(12, "Use at least 12 characters").max(200),
});

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth();
  if (!rateLimit("pw:" + auth.userId, 5, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Try again later.");
  const { current, next } = Body.parse(await req.json());
  const u = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (!(await bcrypt.compare(current, u.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  if (current === next) throw new HttpError(400, "Choose a different password");
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 12) } }),
    prisma.session.deleteMany({ where: { userId: u.id, id: { not: auth.sessionId } } }), // sign out other devices
    prisma.auditLog.create({ data: { actorId: u.id, action: "auth.password.changed" } }),
  ]);
  return NextResponse.json({ ok: true });
});

/** DELETE: sign out every other session. */
export const DELETE = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth();
  const r = await prisma.session.deleteMany({ where: { userId: auth.userId, id: { not: auth.sessionId } } });
  await prisma.auditLog.create({ data: { actorId: auth.userId, action: "auth.sessions.revoked", meta: { count: r.count } } });
  return NextResponse.json({ revoked: r.count });
});
