import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/feedback-meta";
import { EmptyState, NativeSelect, StatusBadge, TONE_DOT, categoryIcon, fmtDate, toneOf } from "./bits";
import type { listStaff, formOptions, statusCounts } from "@/server/feedback";

type Data = Awaited<ReturnType<typeof listStaff>>;
type Opts = Awaited<ReturnType<typeof formOptions>>;
type Counts = Awaited<ReturnType<typeof statusCounts>>;

const TABS: { key: string; label: string }[] = [
  { key: "open", label: "Active" }, { key: "OPEN", label: STATUS_LABEL.OPEN }, { key: "IN_REVIEW", label: STATUS_LABEL.IN_REVIEW },
  { key: "ON_HOLD", label: STATUS_LABEL.ON_HOLD }, { key: "RESOLVED", label: STATUS_LABEL.RESOLVED }, { key: "CLOSED", label: STATUS_LABEL.CLOSED },
  { key: "all", label: "All" },
];
const PRI_CHIP: Record<number, string> = {
  3: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  4: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function CaseList({ data, opts, basePath, filters, counts }: {
  data: Data; opts: Opts; basePath: string; filters: Record<string, string | undefined>; counts: Counts;
}) {
  const status = filters.status ?? "open";
  const qs = (patch: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { ...filters, page: undefined, ...patch };
    const p = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1]));
    return `${basePath}?${p.toString()}`;
  };
  const caseHref = basePath.startsWith("/admin") ? "/admin/feedback/" : "/hr/cases/";
  const activeFilters = [filters.category, filters.priority, filters.department].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* status distribution: one segment per status, sized by its share; each segment opens that tab */}
      {counts.all > 0 && (
        <div className="space-y-2">
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-sm bg-muted" role="img"
            aria-label={`Status distribution: ${STATUSES.map((s) => `${STATUS_LABEL[s]} ${counts[s as keyof Counts]}`).join(", ")}`}>
            {STATUSES.filter((s) => counts[s as keyof Counts] > 0).map((s) => (
              <Link key={s} href={qs({ status: s })} title={`${STATUS_LABEL[s]}: ${counts[s as keyof Counts]}`}
                style={{ flexGrow: counts[s as keyof Counts] }}
                className={cn("h-full min-w-1.5 transition-opacity hover:opacity-80", TONE_DOT[toneOf(s)], status !== s && STATUSES.includes(status as Status) && "opacity-40")} />
            ))}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {STATUSES.filter((s) => counts[s as keyof Counts] > 0).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", TONE_DOT[toneOf(s)])} />
                {STATUS_LABEL[s]} <span className="tabular-nums text-foreground">{Math.round((counts[s as keyof Counts] / counts.all) * 100)}%</span>
              </span>
            ))}
          </p>
        </div>
      )}

      {/* status tabs */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Status">
        {TABS.map((t) => {
          const on = status === t.key;
          const n = counts[t.key as keyof Counts];
          return (
            <Link key={t.key} href={qs({ status: t.key })} aria-current={on ? "page" : undefined}
              className={cn("flex shrink-0 items-center gap-2 rounded-md border px-3.5 py-1.5 text-sm transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              {STATUSES.includes(t.key as Status) && <span className={cn("size-1.5 rounded-full", TONE_DOT[toneOf(t.key)])} />}
              {t.label}
              <span className={cn("rounded px-1.5 text-xs tabular-nums", on ? "bg-primary-foreground/20" : "bg-muted")}>{n}</span>
            </Link>
          );
        })}
      </nav>

      {/* search + optional filters */}
      <form action={basePath} className="space-y-2">
        <input type="hidden" name="status" value={status} />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={filters.q} placeholder="Search title or FB-…" className="pl-8" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </div>
        <details className="group" open={activeFilters > 0}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <SlidersHorizontal className="size-3.5" /> Filters{activeFilters > 0 && <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">{activeFilters}</span>}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <NativeSelect name="category" defaultValue={filters.category ?? ""} aria-label="Category">
              <option value="">All topics</option>{opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
            <NativeSelect name="priority" defaultValue={filters.priority ?? ""} aria-label="Priority">
              <option value="">Any priority</option>{opts.priorities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
            <NativeSelect name="department" defaultValue={filters.department ?? ""} aria-label="Department">
              <option value="">All departments</option>{opts.departments.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </div>
        </details>
      </form>

      {data.rows.length === 0 ? (
        <EmptyState title="Nothing here" text="No feedback matches." />
      ) : (
        <ul className="space-y-2">
          {data.rows.map((f) => {
            const Icon = categoryIcon(f.category.name);
            return (
              <li key={f.id}>
                <Link href={caseHref + f.id} className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3 pl-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:gap-4">
                  <span className={cn("absolute inset-y-0 left-0 w-1", TONE_DOT[toneOf(f.status)])} aria-hidden />
                  <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:text-primary sm:grid"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      {f.category.sensitive && <Lock className="size-3.5 shrink-0 text-rose-600 dark:text-rose-300" aria-label="Sensitive" />}
                      <span className="truncate">{f.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      <span className="font-mono">{f.reference}</span> · {f.category.name}{f.department ? ` · ${f.department.name}` : ""} · {fmtDate(f.submittedOn)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    {PRI_CHIP[f.priority.rank] && <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", PRI_CHIP[f.priority.rank])}>{f.priority.name}</span>}
                    <StatusBadge status={f.status as Status} />
                    {f.assignments[0] && (
                      <span title={f.assignments[0].assignee.displayName} className="hidden size-7 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary sm:grid">
                        {f.assignments[0].assignee.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.page} / {data.pages}</span>
          <div className="flex gap-2">
            <Link aria-disabled={data.page <= 1} href={qs({ status, page: String(data.page - 1) })} className={cn(buttonVariants({ variant: "outline", size: "sm" }), data.page <= 1 && "pointer-events-none opacity-50")}><ChevronLeft /> Prev</Link>
            <Link aria-disabled={data.page >= data.pages} href={qs({ status, page: String(data.page + 1) })} className={cn(buttonVariants({ variant: "outline", size: "sm" }), data.page >= data.pages && "pointer-events-none opacity-50")}>Next <ChevronRight /></Link>
          </div>
        </div>
      )}
    </div>
  );
}
