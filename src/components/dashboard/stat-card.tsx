"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Archive, CheckCircle2, CircleDot, Inbox, Pause, Search, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { inbox: Inbox, open: CircleDot, review: Search, hold: Pause, resolved: CheckCircle2, closed: Archive, timer: Timer };
export type StatIcon = keyof typeof ICONS;
/** Icon tile colours per card. */
const TILE: Record<StatIcon, string> = {
  inbox: "bg-primary/10 text-primary",
  open: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  review: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  hold: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  timer: "bg-primary/10 text-primary",
};

function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!ref.current) return;
    if (reduce) { ref.current.textContent = value.toFixed(decimals); return; }
    const c = animate(0, value, { duration: 0.8, ease: "easeOut", onUpdate: (v) => { if (ref.current) ref.current.textContent = v.toFixed(decimals); } });
    return () => c.stop();
  }, [value, decimals, reduce]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}

export function StatCard({ label, value, suffix, icon, index = 0, href }: {
  label: string; value: number | null; suffix?: string; icon: StatIcon; index?: number; href?: string;
}) {
  const Icon = ICONS[icon];
  const reduce = useReducedMotion();
  const body = (
    <div className={cn("flex h-full flex-col justify-between gap-4 rounded-2xl border bg-card p-4 transition", href && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md")}>
      <span className={cn("grid size-9 place-items-center rounded-xl", TILE[icon])}><Icon className="size-4" /></span>
      <div>
        <div className="truncate text-2xl font-bold tabular-nums leading-none md:text-3xl">
          {value === null ? "—" : <Counter value={value} decimals={Number.isInteger(value) ? 0 : 1} />}
          {value !== null && suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
        </div>
        <div className="mt-1.5 truncate text-sm text-muted-foreground" title={label}>{label}</div>
      </div>
    </div>
  );
  return (
    // h-full keeps every card in a row the same height.
    <motion.div className="h-full" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      {href ? <Link href={href} className="block h-full">{body}</Link> : body}
    </motion.div>
  );
}
