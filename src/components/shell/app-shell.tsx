"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LogOut, Menu, PanelLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "./brand-mark";
import { FreshOnBack, hardNavigate } from "./fresh-on-back";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV, type Area } from "./nav";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme/theme";

function isActive(path: string, href: string) {
  // Match whole path segments only: "/submit" must not match "/submissions".
  return href === "/" || href === "/hr" || href === "/admin" ? path === href : path === href || path.startsWith(href + "/");
}

export function AppShell({ area, user, company = "Feed", logo = null, hidden = [], notifications = true, children }: {
  area: Area; user: { name: string }; company?: string; logo?: string | null; hidden?: string[]; notifications?: boolean; children: React.ReactNode;
}) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  // Remember the choice per browser (a UI preference only; nothing sensitive).
  useEffect(() => { try { setCollapsed(localStorage.getItem("feed.sidebar") === "collapsed"); } catch {} }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("feed.sidebar", c ? "open" : "collapsed"); } catch {}
    return !c;
  });
  const nav = { ...NAV[area], groups: NAV[area].groups.map((g) => ({ ...g, items: g.items.filter((i) => !hidden.includes(i.href)) })) };
  const allItems = nav.groups.flatMap((g) => g.items);
  const mobileItems = allItems.filter((i) => i.mobile).slice(0, 4);
  // Pages not in the phone bar are reachable from "More", so every page works on a phone.
  const hasMore = allItems.length > mobileItems.length;
  const moreActive = allItems.some((i) => !mobileItems.includes(i) && isActive(path, i.href));
  const [moreOpen, setMoreOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    hardNavigate("/login"); // full reload: nothing from the signed-in session stays in memory for Back
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <FreshOnBack />
      {/* Desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar transition-[width] md:flex", collapsed ? "w-16" : "w-72")}>
        <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center" : "gap-3 px-3")}>
          {!collapsed && (
            <>
              <BrandMark logo={logo} company={company} />
              <div className="min-w-0 flex-1 leading-tight"><div className="truncate font-semibold">{company}</div><div className="truncate text-xs text-muted-foreground">Confidential feedback</div></div>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
            <PanelLeft className="size-4" />
          </Button>
        </div>
        {!collapsed && (
          <div className="m-3 rounded-lg border px-3 py-2.5">
            <div className="text-sm font-medium">{nav.name}</div>
            <div className="text-xs text-muted-foreground">Workspace</div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-2 py-1">
          {nav.groups.map((g, gi) => (
            <div key={gi} className="mb-2 flex flex-col gap-1">
              {gi > 0 && <Separator className="my-2" />}
              {g.title && !collapsed && <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>}
              {g.items.map((it) => {
                const active = isActive(path, it.href);
                return (
                  <Link key={it.href} href={it.href} title={it.label}
                    aria-label={collapsed ? it.label : undefined}
                    className={cn("relative flex items-center rounded-md py-2.5 text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      collapsed ? "justify-center px-0" : "gap-3 px-3", active && "text-foreground font-medium")}>
                    {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md bg-accent" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />}
                    <it.icon className="relative size-[18px] shrink-0" />
                    {!collapsed && <span className="relative truncate">{it.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={cn("flex items-center border-t p-3", collapsed ? "flex-col gap-2" : "gap-3")}>
          <Avatar className="size-8" title={user.name}><AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          {!collapsed && <div className="min-w-0 flex-1 truncate text-sm">{user.name}</div>}
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut className="size-4" /></Button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <BrandMark logo={logo} company={company} size="sm" />
          <span className="truncate font-semibold">{company}</span>
          <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">· {nav.name}</span>
          <div className="ml-auto flex items-center">{notifications && <NotificationBell />}<ThemeToggle /><Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="size-4" /></Button></div>
        </header>
        {notifications && <div className="absolute right-6 top-4 z-10 hidden md:block"><NotificationBell /></div>}

        <AnimatePresence mode="wait">
          <motion.main key={path}
            initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-10">
            {children}
          </motion.main>
        </AnimatePresence>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-20 grid border-t bg-background/95 backdrop-blur md:hidden"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length + (hasMore ? 1 : 0)}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {mobileItems.map((it) => {
            const active = isActive(path, it.href);
            return (
              <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground", active && "text-primary")}>
                <it.icon className="size-5" />
                <span className="truncate">{it.short ?? it.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger render={<button type="button" className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground", moreActive && "text-primary")} />}>
                <Menu className="size-5" /><span>More</span>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="space-y-4 px-4">
                  {nav.groups.map((g, gi) => (
                    <div key={gi}>
                      {g.title && <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>}
                      <div className="grid grid-cols-2 gap-2">
                        {g.items.map((it) => (
                          <Link key={it.href} href={it.href} onClick={() => setMoreOpen(false)}
                            className={cn("flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-medium", isActive(path, it.href) ? "border-primary/40 bg-primary/10 text-primary" : "hover:bg-accent")}>
                            <it.icon className="size-4 shrink-0" /><span className="truncate">{it.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
