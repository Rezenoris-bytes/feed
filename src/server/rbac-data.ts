// Plain data (no server-only import) so the seed script and tests can share it.
export const PERMISSIONS = [
  "feedback.submit",
  "feedback.read.own",
  "feedback.read.all",
  "feedback.read.assigned",
  "feedback.assign",
  "feedback.status.update",
  "feedback.status.override",
  "feedback.note",
  "feedback.message",
  "reports.view",
  "reports.export",
  "identity.reveal",
  "identity.audit.view",
  "admin.users",
  "admin.departments",
  "admin.categories",
  "admin.settings",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
type RoleKey = "SUPER_ADMIN" | "HR" | "REVIEWER" | "EMPLOYEE";

export const ROLE_PERMISSIONS_SEED: Record<RoleKey, Permission[]> = {
  SUPER_ADMIN: PERMISSIONS.filter((p) => !["feedback.submit", "feedback.read.own", "identity.reveal", "identity.audit.view"].includes(p)),
  HR: [
    "feedback.read.all", "feedback.assign", "feedback.status.update", "feedback.note",
    "feedback.message", "reports.view", "reports.export",
  ],
  REVIEWER: ["feedback.read.assigned", "feedback.status.update", "feedback.note", "feedback.message"],
  // Employees never sign in: all submissions are anonymous via the public pages.
  EMPLOYEE: [],
};
