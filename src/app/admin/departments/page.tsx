import { PageHeader } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddNamedItem, ToggleSwitch } from "@/components/admin/client";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";

export default async function Departments() {
  await guardPage(["SUPER_ADMIN"]);
  const rows = await prisma.department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true, feedback: true } } } });
  return (
    <>
      <PageHeader title="Departments" description="Used for routing feedback and scoping reviewers. Deactivate instead of deleting so history is kept." />
      <div className="mb-4"><AddNamedItem kind="dept" placeholder="New department name" /></div>
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">People</TableHead><TableHead className="text-right">Feedback</TableHead><TableHead className="text-right">Active</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} className={d.isActive ? "" : "opacity-60"}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-right tabular-nums">{d._count.users}</TableCell>
                <TableCell className="text-right tabular-nums">{d._count.feedback}</TableCell>
                <TableCell className="text-right"><ToggleSwitch action="dept.update" id={d.id} field="active" checked={d.isActive} label="Active" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}