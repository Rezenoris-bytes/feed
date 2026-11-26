import Link from "next/link";
import { ChevronLeft, ChevronRight, EyeOff, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUSES, STATUS_LABEL } from "@/lib/feedback-meta";
import { EmptyState, NativeSelect, StatusBadge, fmtDate } from "./bits";
import type { listStaff, formOptions } from "@/server/feedback";

type Data = Awaited<ReturnType<typeof listStaff>>;
type Opts = Awaited<ReturnType<typeof formOptions>>;
const PRI_TONE = ["", "text-muted-foreground", "text-foreground", "text-amber-700 dark:text-amber-300", "text-rose-700 dark:text-rose-300"];

export function CaseList({ data, opts, basePath, filters, showFilters = true }: {
  data: Data; opts: Opts; basePath: string; filters: Record<string, string | undefined>; showFilters?: boolean;
}) {
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...filters, ...patch }).filter(([, v]) => v) as [string, string][]);
    return "?" + p.toString();
  };
  const caseHref = basePath.startsWith("/admin") ? "/admin/feedback/" : "/hr/cases/";

  return (
    <div className="space-y-4">
      {showFilters && (
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_150px_170px_130px_150px_140px_auto]" action={basePath}>
          <Input name="q" defaultValue={filters.q} placeholder="Search reference or title" />
          <NativeSelect name="status" defaultValue={filters.status ?? "open"}>
            <option value="open">Open</option><option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </NativeSelect>
          <NativeSelect name="category" defaultValue={filters.category ?? ""}>
            <option value="">All categories</option>{opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          <NativeSelect name="priority" defaultValue={filters.priority ?? ""}>
            <option value="">Any priority</option>{opts.priorities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          <NativeSelect name="department" defaultValue={filters.department ?? ""}>
            <option value="">All departments</option>{opts.departments.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          <NativeSelect name="kind" defaultValue={filters.kind ?? ""}>
            <option value="">All types</option><option value="confidential">Confidential</option><option value="anonymous">Anonymous</option>
          </NativeSelect>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      )}

      {data.rows.length === 0 ? (
        <EmptyState title="No feedback found" text="Nothing matches these filters yet." />
      ) : (
        <Card className="divide-y p-0">
          {data.rows.map((f) => (
            <Link key={f.id} href={caseHref + f.id} className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate font-medium">
                  {f.category.sensitive && <Lock className="size-3.5 shrink-0 text-rose-700 dark:text-rose-300" aria-label="Sensitive" />}
                  {f.anonymous && <EyeOff className="size-3.5 shrink-0 text-muted-foreground" aria-label="Anonymous" />}
                  <span className="truncate">{f.title}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span className="font-mono">{f.reference}</span>{f.anonymous && <span>· Anonymous</span>}<span>· {f.category.name}</span>
                  {f.department && <span>· {f.department.name}</span>}<span>· {fmtDate(f.submittedOn)}</span>
                  {f.assignments[0] && <span>· {f.assignments[0].assignee.displayName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-xs font-medium", PRI_TONE[f.priority.rank])}>{f.priority.name}</span>
                <StatusBadge status={f.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}

      {data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.total} results · page {data.page} of {data.pages}</span>
          <div className="flex gap-2">
            <Link aria-disabled={data.page <= 1} href={qs({ page: String(data.page - 1) })} className={cn(buttonVariants({ variant: "outline", size: "sm" }), data.page <= 1 && "pointer-events-none opacity-50")}><ChevronLeft /> Prev</Link>
            <Link aria-disabled={data.page >= data.pages} href={qs({ page: String(data.page + 1) })} className={cn(buttonVariants({ variant: "outline", size: "sm" }), data.page >= data.pages && "pointer-events-none opacity-50")}>Next <ChevronRight /></Link>
          </div>
        </div>
      )}
    </div>
  );
}
