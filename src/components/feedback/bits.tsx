import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE, type Status } from "@/lib/feedback-meta";
import { ChevronDown, Inbox, type LucideIcon } from "lucide-react";

const TONE = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30",
  warn: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
  good: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
  bad: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as Status;
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[STATUS_TONE[s] ?? "neutral"], className)}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

export function EmptyState({ title, text, icon: Icon = Inbox, children }: { title: string; text: string; icon?: LucideIcon; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
      <Icon className="mb-3 size-6 text-muted-foreground" />
      <div className="font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/**
 * Native <select> (best on phones: uses the OS picker) with our own chevron so it looks the same in every browser.
 * The browser's own arrow is hidden; the list itself follows the page's light color-scheme.
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
