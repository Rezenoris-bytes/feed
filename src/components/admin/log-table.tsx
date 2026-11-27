import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, fmtDateTime } from "@/components/feedback/bits";
import { cn } from "@/lib/utils";

export function LogTable({ cols, rows, empty }: { cols: string[]; rows: { id: string; at: Date; cells: React.ReactNode[] }[]; empty: string }) {
  if (rows.length === 0) return <EmptyState title="Nothing recorded yet" text={empty} />;
  return (
    <Card className="p-0">
      <Table>
        {/* On phones the last (details) column is hidden so rows stay one or two lines tall. */}
        <TableHeader><TableRow><TableHead className="w-28 sm:w-40">When</TableHead>{cols.map((c, i) => <TableHead key={c} className={cn(i === cols.length - 1 && cols.length > 2 && "hidden md:table-cell")}>{c}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}><TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground sm:text-sm">{fmtDateTime(r.at)}</TableCell>
              {r.cells.map((c, i) => <TableCell key={i} className={cn("max-w-md whitespace-normal break-words align-top", i === r.cells.length - 1 && r.cells.length > 2 && "hidden md:table-cell")}>{c}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}