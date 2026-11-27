import { cn } from "@/lib/utils";
import { STAGES, STATUS_LABEL, STATUS_TONE, stageIndex, type Status } from "@/lib/feedback-meta";
import {
  Briefcase, Building2, Check, ChevronDown, CircleHelp, Coins, HeartHandshake, Inbox, Lightbulb, MessageSquare, Pause,
  ShieldAlert, ThumbsUp, TriangleAlert, Users, type LucideIcon,
} from "lucide-react";

/** Status colours: dot + soft fill, readable in light and dark. */
export const TONE_CLASS = {
  open: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/25",
  review: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25",
  hold: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25",
  neutral: "bg-muted text-muted-foreground ring-border",
};
export const TONE_DOT = { open: "bg-sky-500", review: "bg-violet-500", hold: "bg-amber-500", good: "bg-emerald-500", neutral: "bg-slate-400" };
export const toneOf = (s: string) => STATUS_TONE[s as Status] ?? "neutral";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = toneOf(status);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONE_CLASS[tone], className)}>
      <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      {STATUS_LABEL[status as Status] ?? status}
    </span>
  );
}

/** Four-step progress (Open → In review → Resolved → Closed). On hold shows as a pause on "In review". */
export function StatusProgress({ status, className }: { status: string; className?: string }) {
  const s = status as Status;
  const current = stageIndex(s);
  const hold = s === "ON_HOLD";
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label={`Status: ${STATUS_LABEL[s]}`}>
      {STAGES.map((stage, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={stage} className="flex flex-1 flex-col items-center last:flex-none sm:last:flex-1">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "invisible" : done || active ? "bg-primary" : "bg-border")} />
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && !hold && "border-primary bg-primary/10 text-primary",
                active && hold && "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
                !done && !active && "border-border text-muted-foreground")}>
                {done ? <Check className="size-4" /> : active && hold ? <Pause className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === STAGES.length - 1 ? "invisible" : done ? "bg-primary" : "bg-border")} />
            </div>
            <span className={cn("mt-1.5 text-center text-[11px] sm:text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {active && hold ? "On hold" : STATUS_LABEL[stage]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Icon per category (matched by name, so renamed/added categories fall back gracefully). */
const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/harass|misconduct/i, ShieldAlert], [/salary|benefit|pay/i, Coins], [/management|manager/i, Briefcase],
  [/team|conflict/i, Users], [/environment|safety|facilit/i, Building2], [/suggest|idea/i, Lightbulb],
  [/positive|praise|thank/i, ThumbsUp], [/hr/i, HeartHandshake], [/complaint/i, TriangleAlert],
  [/general/i, MessageSquare],
];
export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS.find(([re]) => re.test(name))?.[1] ?? CircleHelp;
}

export function EmptyState({ title, text, icon: Icon = Inbox, children }: { title: string; text?: string; icon?: LucideIcon; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-muted"><Icon className="size-5 text-muted-foreground" /></div>
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/**
 * Native <select> (best on phones: uses the OS picker) with our own chevron so it looks the same in every browser.
 */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <select
        className="h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-input bg-background pl-2.5 pr-8 text-base md:text-sm outline-none transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 [&_optgroup]:font-semibold [&_optgroup]:text-muted-foreground [&_option]:text-foreground"
        {...props}
      />
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
