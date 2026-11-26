import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, ROLE_PERMISSIONS } from "@/server/rbac";

describe("permission matrix", () => {
  it("nobody can reveal identity (employees submit anonymously; there is nothing to reveal)", () => {
    for (const role of ["SUPER_ADMIN", "HR", "REVIEWER", "EMPLOYEE"] as const) {
      expect(can([role], "identity.reveal")).toBe(false);
      expect(can([role], "identity.audit.view")).toBe(false);
    }
  });

  it("HR cannot administer users, settings or the audit log", () => {
    for (const p of ["admin.users", "admin.settings", "admin.categories", "admin.departments", "audit.view"] as const) expect(can(["HR"], p)).toBe(false);
  });

  it("reviewers only see assigned work and can't assign, export or read everything", () => {
    expect(can(["REVIEWER"], "feedback.read.assigned")).toBe(true);
    for (const p of ["feedback.read.all", "feedback.assign", "reports.export", "reports.view"] as const) expect(can(["REVIEWER"], p)).toBe(false);
  });

  it("employee accounts have no permissions at all (no employee login)", () => {
    for (const p of PERMISSIONS) expect(can(["EMPLOYEE"], p)).toBe(false);
  });

  it("deny by default for unknown or empty roles", () => {
    expect(can([], "feedback.read.all")).toBe(false);
    expect(can(["NOT_A_ROLE" as never], "feedback.read.all")).toBe(false);
  });

  it("every granted permission exists", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) for (const p of perms) expect(PERMISSIONS).toContain(p);
  });
});
