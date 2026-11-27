import { PageHeader } from "@/components/shell/app-shell";
import { CreateUserButton } from "@/components/admin/client";
import { UserTable } from "@/components/admin/user-table";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";

const LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", HR: "HR administrator", REVIEWER: "Department reviewer" };

export default async function Staff() {
  await guardPage(["SUPER_ADMIN"]);
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { key: { in: ["HR", "REVIEWER", "SUPER_ADMIN"] } } } } }, orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, email: true, isActive: true, mfaEnabled: true, department: { select: { name: true } }, roles: { select: { role: { select: { key: true } } } },
        _count: { select: { assignments: { where: { active: true } } } } },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="HR & reviewers" description="People who handle feedback">
        <CreateUserButton role="STAFF" departments={departments} label="Add staff member" />
      </PageHeader>
      <UserTable extraLabel="Open cases" rows={users.map((u) => {
        const key = u.roles[0]?.role.key ?? "";
        return { id: u.id, displayName: u.displayName, email: u.email, isActive: u.isActive, role: LABEL[key] ?? key,
          department: u.department?.name ?? null, extra: String(u._count.assignments), locked: key === "SUPER_ADMIN" };
      })} />
    </>
  );
}