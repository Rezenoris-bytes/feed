"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDateTime } from "@/components/feedback/bits";
import { cn } from "@/lib/utils";

type Item = { id: string; text: string; link: string | null; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setItems(d.items); setUnread(d.unread); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Popover onOpenChange={async (open) => {
      if (open && unread > 0) { await fetch("/api/notifications", { method: "POST" }); setUnread(0); }
    }}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative" />}>
        <Bell className="size-[18px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {items.map((n) => {
            const body = (
              <div className={cn("border-b px-4 py-3 text-sm last:border-0", !n.readAt && "bg-primary/5")}>
                <div>{n.text}</div><div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</div>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} className="block hover:bg-accent/50">{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
