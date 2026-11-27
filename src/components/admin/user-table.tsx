import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/bits";
import { UserRowActions } from "./client";

export type UserRow = { id: string; displayName: string; email: string; isActive: boolean; role: string; department: string | null; extra?: string | null; lastSeen?: string | null; locked?: boolean };

export function UserTable({ rows, extraLabel }: { rows: UserRow[]; extraLabel?: string }) {
  if (rows.length === 0) return <EmptyState title="No accounts yet" text="Create the first account with the button above." />;
  return (
    <Card className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Role</TableHead>
          <TableHead className="hidden md:table-cell">Department</TableHead>{extraLabel && <TableHead className="hidden lg:table-cell">{extraLabel}</TableHead>}
          <TableHead className="text-right">Active</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id} className={u.isActive ? "" : "opacity-60"}>
              <TableCell className="max-w-0 w-full">
                {/* max-w-0 + truncate: long emails shrink instead of pushing the Active switch off a phone screen */}
                <div className="truncate font-medium">{u.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                <div className="truncate text-xs text-muted-foreground md:hidden">{u.role}{u.department ? ` · ${u.department}` : ""}</div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{u.role}</TableCell>
              <TableCell className="hidden md:table-cell">{u.department ?? "—"}</TableCell>
              {extraLabel && <TableCell className="hidden lg:table-cell">{u.extra ?? "—"}</TableCell>}
              <TableCell><UserRowActions id={u.id} active={u.isActive} locked={u.locked} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}