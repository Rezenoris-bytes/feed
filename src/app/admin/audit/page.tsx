import { PageHeader } from "@/components/shell/app-shell";
import { LogTable } from "@/components/admin/log-table";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";

const LABEL: Record<string, string> = {
  "auth.login": "Signed in", "auth.mfa.verified": "Verified authenticator code", "auth.mfa.failed": "Wrong authenticator code",
  "auth.password.changed": "Changed password", "auth.sessions.revoked": "Signed out other devices",
  "feedback.status": "Changed case status", "feedback.status.override": "Overrode case status", "feedback.assign": "Assigned case",
  "report.export": "Exported report",
};

export default async function Audit() {
  await guardPage(["SUPER_ADMIN"]);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorId).filter(Boolean) as string[])] } }, select: { id: true, displayName: true } });
  const name = Object.fromEntries(users.map((u) => [u.id, u.displayName]));
  return (
    <>
      <PageHeader title="Audit log" description="Sign-ins, case changes, exports and admin actions. Most recent 300. Entries can't be edited or deleted." />
      <LogTable cols={["Who", "Action", "Details"]} empty="Activity will appear here."
        rows={logs.map((l) => ({ id: l.id, at: l.createdAt, cells: [
          l.actorId ? name[l.actorId] ?? "Unknown account" : "System",
          LABEL[l.action] ?? l.action.replace(/^admin\./, "Admin: "),
          <span key="m" className="font-mono text-xs text-muted-foreground">{l.meta ? JSON.stringify(l.meta) : ""}</span>,
        ] }))} />
    </>
  );
}