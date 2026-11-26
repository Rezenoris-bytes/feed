import "server-only";
import type { RoleKey } from "@prisma/client";
import { ROLE_PERMISSIONS_SEED, type Permission } from "./rbac-data";

export { PERMISSIONS, type Permission } from "./rbac-data";
export const ROLE_PERMISSIONS = ROLE_PERMISSIONS_SEED;

export function can(roles: RoleKey[], perm: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(perm));
}

export class HttpError extends Error {
  constructor(public status: number, public publicMessage: string) {
    super(publicMessage);
  }
}
// 404 instead of 403 so unauthorized callers can't probe what exists.
export const notFound = () => new HttpError(404, "Not found");
