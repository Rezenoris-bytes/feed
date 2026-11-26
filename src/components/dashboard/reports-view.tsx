import Link from "next/link";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Stats } from "@/server/stats";
import { DashboardCharts } from "./charts";

const PERIODS = [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["quarter", "Quarterly"], ["year", "Yearly"]] as const;

function Breakdown({ title, data, total }: { title: string; data: { name: string; value: number }[]; total: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Share</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No data</TableCell></TableRow>}
            {data.map((d) => (
              <TableRow key={d.name}><TableCell>{d.name}</TableCell><TableCell className="text-right tabular-nums">{d.value}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ReportsView({ stats, period, label, basePath }: { stats: Stats; period: string; label: string; basePath: string }) {
  return (
    <>
      <PageHeader title="Reports" description={`${label}. Exports contain case metadata only. No descriptions, messages or identities.`}>
        <div className="flex gap-2">
          <a href={`/api/reports?format=csv&period=${period}`} className={buttonVariants({ variant: "outline" })}><FileSpreadsheet /> CSV</a>
          <a href={`/api/reports?format=pdf&period=${period}`} className={buttonVariants()}><Download /> PDF</a>
        </div>
      </PageHeader>
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border p-1 w-fit">
        {PERIODS.map(([k, l]) => (
          <Link key={k} href={`${basePath}?period=${k}`} className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground", period === k && "bg-accent text-foreground")}>{l}</Link>
        ))}
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([["Total", stats.total], ["Pending", stats.kpis.pending], ["Investigating", stats.kpis.investigating], ["Resolved", stats.kpis.resolved], ["Escalated", stats.kpis.escalated], ["Avg. days to resolve", stats.kpis.avgResolutionDays ?? "—"]] as const).map(([l, v]) => (
          <Card key={l} className="gap-1 p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold tabular-nums">{v}</div></Card>
        ))}
      </div>
      <DashboardCharts stats={stats} />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Breakdown title="Category report" data={stats.byCategory} total={stats.total} />
        <Breakdown title="Department report" data={stats.byDepartment} total={stats.total} />
        <Breakdown title="Status / resolution report" data={stats.byStatus} total={stats.total} />
        <Breakdown title="Priority report" data={stats.byPriority} total={stats.total} />
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-3.5" /> Every export is recorded in the audit log.</p>
    </>
  );
}
