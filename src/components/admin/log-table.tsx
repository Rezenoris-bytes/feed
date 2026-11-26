import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, fmtDateTime } from "@/components/feedback/bits";

export function LogTable({ cols, rows, empty }: { cols: string[]; rows: { id: string; at: Date; cells: React.ReactNode[] }[]; empty: string }) {
  if (rows.length === 0) return <EmptyState title="Nothing recorded yet" text={empty} />;
  return (
    <Card className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead className="w-40">When</TableHead>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}><TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.at)}</TableCell>
              {r.cells.map((c, i) => <TableCell key={i} className="max-w-md whitespace-normal break-words">{c}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}