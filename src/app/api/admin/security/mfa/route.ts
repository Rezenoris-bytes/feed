import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticator } from "otplib";
import { prisma } from "@/server/db";
import { decrypt } from "@/server/crypto";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { HttpError, notFound } from "@/server/rbac";
import { adminMfaRequired } from "@/server/mfa-policy";

authenticator.options = { window: 1 };

const Body = z.object({
  enabled: z.boolean(),
  password: z.string().min(1).max(200),
  code: z.string().regex(/^\d{6}$/).optional(),
});

/**
 * Turns the "Super Admins must use an authenticator code" rule on or off.
 * Off: needs the password AND a current authenticator code (a stolen session alone can't do it).
 * On: needs the password; the caller is then sent to enter or set up a code.
 */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth();
  if (!auth.roles.includes("SUPER_ADMIN")) throw notFound();
  if (!rateLimit("mfa-policy:" + auth.userId, 5, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Try again later.");
  const { enabled, password, code } = Body.parse(await req.json());

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(400, "Password is incorrect");

  const currently = await adminMfaRequired();
  if (enabled === currently) return NextResponse.json({ enabled, next: null });

  if (!enabled && user.mfaEnabled) {
    if (!code) throw new HttpError(400, "Enter a current code from your authenticator app");
    const secret = user.mfaSecretEnc ? decrypt(user.mfaSecretEnc).toString("utf8") : "";
    if (!secret || !authenticator.check(code, secret)) throw new HttpError(400, "Authenticator code is incorrect");
  }

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "security" }, update: { value: { requireAdminMfa: enabled } }, create: { key: "security", value: { requireAdminMfa: enabled } },
    }),
    prisma.auditLog.create({ data: { actorId: auth.userId, action: enabled ? "security.adminMfa.on" : "security.adminMfa.off" } }),
  ]);

  // Turning it back on applies immediately: this session hasn't entered a code, so send them to do it now.
  const next = enabled && !auth.mfaVerified ? (user.mfaEnabled ? "/mfa" : "/mfa/setup") : null;
  return NextResponse.json({ enabled, next });
});
