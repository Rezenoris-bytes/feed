"use client";
import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { AlertOctagon, CheckCircle2, Clock, Inbox, Search, Sparkles, Timer } from "lucide-react";

const ICONS = { inbox: Inbox, new: Sparkles, pending: Clock, search: Search, resolved: CheckCircle2, escalated: AlertOctagon, timer: Timer };
export type StatIcon = keyof typeof ICONS;
import { Card } from "@/components/ui/card";

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

export function StatCard({ label, value, suffix, icon, tone = "text-primary", index = 0 }: {
  label: string; value: number | null; suffix?: string; icon: StatIcon; tone?: string; index?: number;
}) {
  const Icon = ICONS[icon];
  const reduce = useReducedMotion();
  return (
    // h-full + one-line label keep every card in the row the same height; hover changes shadow only (no shifting).
    <motion.div className="h-full" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Card className="h-full justify-between gap-3 p-4 transition-shadow hover:shadow-md">
        <div className="flex min-w-0 items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="truncate" title={label}>{label}</span>
          <Icon className={`size-4 shrink-0 ${tone}`} />
        </div>
        <div className="truncate text-2xl font-semibold tabular-nums leading-none md:text-3xl">
          {value === null ? "—" : <Counter value={value} decimals={Number.isInteger(value) ? 0 : 1} />}
          {value !== null && suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
        </div>
      </Card>
    </motion.div>
  );
}
