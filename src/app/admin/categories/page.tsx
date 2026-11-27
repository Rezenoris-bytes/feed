import { PageHeader } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddNamedItem, ToggleSwitch } from "@/components/admin/client";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";

export default async function Categories() {
  await guardPage(["SUPER_ADMIN"]);
  const rows = await prisma.feedbackCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { feedback: true } } } });
  return (
    <>
      <PageHeader title="Categories" description="Topics employees can pick" />
      <div className="mb-4"><AddNamedItem kind="category" placeholder="New category name" /></div>
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Feedback</TableHead><TableHead className="text-right">Sensitive</TableHead><TableHead className="text-right">Active</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className={c.isActive ? "" : "opacity-60"}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right tabular-nums">{c._count.feedback}</TableCell>
                <TableCell className="text-right"><ToggleSwitch action="category.update" id={c.id} field="sensitive" checked={c.sensitive} label="Sensitive" /></TableCell>
                <TableCell className="text-right"><ToggleSwitch action="category.update" id={c.id} field="active" checked={c.isActive} label="Active" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}