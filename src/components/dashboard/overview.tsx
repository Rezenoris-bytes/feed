import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { cn } from "@/lib/utils";
import type { Stats } from "@/server/stats";
import { StatCard } from "./stat-card";
import { DashboardCharts } from "./charts";

export const PERIODS = [["week", "7d"], ["month", "30d"], ["quarter", "3m"], ["year", "12m"]] as const;

export function PeriodTabs({ basePath, period }: { basePath: string; period: string }) {
  return (
    <div className="inline-flex w-fit shrink-0 rounded-xl border bg-card p-1">
      {PERIODS.map(([k, l]) => (
        <Link key={k} href={`${basePath}?period=${k}`} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground", period === k && "bg-primary text-primary-foreground hover:text-primary-foreground")}>{l}</Link>
      ))}
    </div>
  );
}

export function Overview({ title, stats, basePath, period, showDepartments, inboxPath }: {
  title: string; description?: string; stats: Stats; basePath: string; period: string; showDepartments?: boolean; inboxPath: string;
}) {
  const k = stats.kpis;
  const to = (s: string) => `${inboxPath}?status=${s}`;
  return (
    <>
      <PageHeader title={title}><PeriodTabs basePath={basePath} period={period} /></PageHeader>
      <div className="mb-6 grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <StatCard index={0} label="Total" value={stats.total} icon="inbox" href={to("all")} />
        <StatCard index={1} label="Open" value={k.open} icon="open" href={to("OPEN")} />
        <StatCard index={2} label="In review" value={k.inReview} icon="review" href={to("IN_REVIEW")} />
        <StatCard index={3} label="On hold" value={k.onHold} icon="hold" href={to("ON_HOLD")} />
        <StatCard index={4} label="Resolved" value={k.resolved} icon="resolved" href={to("RESOLVED")} />
        <StatCard index={5} label="Closed" value={k.closed} icon="closed" href={to("CLOSED")} />
        <StatCard index={6} label="Avg. days to resolve" value={k.avgResolutionDays} icon="timer" />
      </div>
      <DashboardCharts stats={stats} showDepartments={showDepartments} />
    </>
  );
}
