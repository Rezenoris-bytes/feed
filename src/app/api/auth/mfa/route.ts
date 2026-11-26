import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticator } from "otplib";
import { prisma } from "@/server/db";
import { decrypt, encrypt } from "@/server/crypto";
import { getAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { HttpError } from "@/server/rbac";

authenticator.options = { window: 1 };

/** GET: start enrolment (only if MFA not yet enabled) → returns otpauth URI for the authenticator app. */
export const GET = handler(async () => {
  const a = await getAuth();
  if (!a) throw new HttpError(401, "Sign in required");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: a.userId } });
  if (u.mfaEnabled) throw new HttpError(409, "MFA already enabled");
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: u.id }, data: { mfaSecretEnc: encrypt(secret) } });
  return NextResponse.json({ otpauth: authenticator.keyuri(u.email, "Feed", secret), secret });
});

const Body = z.object({ code: z.string().regex(/^\d{6}$/) });

/** POST: verify a code. Confirms enrolment and/or marks the session MFA-fresh. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const a = await getAuth();
  if (!a) throw new HttpError(401, "Sign in required");
  if (!rateLimit("mfa:" + a.userId, 5, 5 * 60_000)) throw new HttpError(429, "Too many attempts. Try again later.");
  const { code } = Body.parse(await req.json());
  const u = await prisma.user.findUniqueOrThrow({ where: { id: a.userId } });
  if (!u.mfaSecretEnc) throw new HttpError(400, "MFA not set up");
  const secret = decrypt(u.mfaSecretEnc).toString("utf8");
  if (!authenticator.check(code, secret)) {
    await prisma.auditLog.create({ data: { actorId: a.userId, action: "auth.mfa.failed" } });
    throw new HttpError(401, "Invalid code");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: true } }),
    prisma.session.update({ where: { id: a.sessionId }, data: { mfaVerified: true, mfaAt: new Date() } }),
    prisma.auditLog.create({ data: { actorId: a.userId, action: "auth.mfa.verified" } }),
  ]);
  return NextResponse.json({ next: "/admin" });
});
