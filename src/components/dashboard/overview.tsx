import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { cn } from "@/lib/utils";
import type { Stats } from "@/server/stats";
import { StatCard } from "./stat-card";
import { DashboardCharts } from "./charts";

export const PERIODS = [["week", "7 days"], ["month", "30 days"], ["quarter", "3 months"], ["year", "12 months"]] as const;

export function PeriodTabs({ basePath, period }: { basePath: string; period: string }) {
  return (
    <div className="inline-flex w-fit shrink-0 rounded-lg border p-1">
      {PERIODS.map(([k, l]) => (
        <Link key={k} href={`${basePath}?period=${k}`} className={cn("whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground", period === k && "bg-accent text-foreground")}>{l}</Link>
      ))}
    </div>
  );
}

export function Overview({ title, description, stats, basePath, period, showDepartments }: {
  title: string; description: string; stats: Stats; basePath: string; period: string; showDepartments?: boolean;
}) {
  const k = stats.kpis;
  return (
    <>
      <PageHeader title={title} description={description}><PeriodTabs basePath={basePath} period={period} /></PageHeader>
      <div className="mb-6 grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard index={0} label="Total" value={stats.total} icon="inbox" />
        <StatCard index={1} label="New" value={k.new} icon="new" tone="text-sky-700 dark:text-sky-300" />
        <StatCard index={2} label="Pending" value={k.pending} icon="pending" tone="text-amber-700 dark:text-amber-300" />
        <StatCard index={3} label="Investigating" value={k.investigating} icon="search" tone="text-amber-700 dark:text-amber-300" />
        <StatCard index={4} label="Resolved" value={k.resolved} icon="resolved" tone="text-emerald-700 dark:text-emerald-300" />
        <StatCard index={5} label="Escalated" value={k.escalated} icon="escalated" tone="text-rose-700 dark:text-rose-300" />
        <StatCard index={6} label="Avg. time" value={k.avgResolutionDays} suffix="days" icon="timer" />
      </div>
      <DashboardCharts stats={stats} showDepartments={showDepartments} />
    </>
  );
}
