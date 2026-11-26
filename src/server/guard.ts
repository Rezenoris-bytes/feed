import "server-only";
import { redirect } from "next/navigation";
import type { RoleKey } from "@prisma/client";
import { getAuth, type AuthContext } from "./session";

/** Page-level guard for server components. API routes use requireAuth() instead. */
export async function guardPage(allowed: RoleKey[]): Promise<AuthContext> {
  const a = await getAuth();
  if (!a) redirect("/login");
  if (a.roles.includes("SUPER_ADMIN") && !a.mfaVerified) redirect("/mfa");
  if (!a.roles.some((r) => allowed.includes(r))) redirect(homeFor(a.roles));
  return a;
}

export function homeFor(roles: RoleKey[]) {
  if (roles.includes("SUPER_ADMIN")) return "/admin";
  if (roles.includes("HR") || roles.includes("REVIEWER")) return "/hr";
  return "/login";
}
