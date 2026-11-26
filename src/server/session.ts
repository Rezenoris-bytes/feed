import "server-only";
import { cookies } from "next/headers";
import type { RoleKey } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { can, HttpError, notFound, type Permission } from "./rbac";

import { cookieNames } from "./cookie-policy";

/** Reads whichever session cookie this browser has (Secure __Host- variant over HTTPS, plain one over http). */
async function readToken() {
  const jar = await cookies();
  for (const n of (await cookieNames("feed_sid")).all) { const v = jar.get(n)?.value; if (v) return v; }
  return undefined;
}
const TTL_MS = 8 * 60 * 60 * 1000; // 8h absolute
export const MFA_FRESH_MS = 5 * 60 * 1000;

export type AuthContext = {
  userId: string;
  displayName: string;
  roles: RoleKey[];
  departmentId: string | null;
  mfaVerified: boolean;
  mfaAt: Date | null;
  sessionId: string;
};

/** Creates a fresh session (new id on every login → no session fixation). */
export async function createSession(userId: string, mfaVerified: boolean) {
  const token = randomToken();
  await prisma.session.create({
    data: { id: sha256(token), userId, mfaVerified, mfaAt: mfaVerified ? new Date() : null, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  const c = await cookieNames("feed_sid");
  (await cookies()).set(c.name, token, {
    httpOnly: true, secure: c.secure, sameSite: "strict", path: "/", maxAge: TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = await readToken();
  if (t) await prisma.session.deleteMany({ where: { id: sha256(t) } });
  for (const n of (await cookieNames("feed_sid")).all) jar.delete(n);
}

export async function getAuth(): Promise<AuthContext | null> {
  const t = await readToken();
  if (!t) return null;
  const s = await prisma.session.findUnique({
    where: { id: sha256(t) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.isActive || s.user.deletedAt) return null;
  const roles = s.user.roles.map((r) => r.role.key).filter((k) => k !== "EMPLOYEE");
  if (roles.length === 0) return null; // employee accounts have no sign-in
  return {
    userId: s.userId, displayName: s.user.displayName, roles, departmentId: s.user.departmentId,
    mfaVerified: s.mfaVerified, mfaAt: s.mfaAt, sessionId: s.id,
  };
}

/** Deny-by-default guard. Super Admin sessions without MFA are treated as unauthenticated. */
export async function requireAuth(perm?: Permission): Promise<AuthContext> {
  const a = await getAuth();
  if (!a) throw new HttpError(401, "Sign in required");
  if (a.roles.includes("SUPER_ADMIN") && !a.mfaVerified) throw new HttpError(401, "MFA required");
  if (perm && !can(a.roles, perm)) throw notFound();
  return a;
}
