"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ThemePref = "system" | "light" | "dark";
const KEY = "feed.theme";

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * A per-device preference only (localStorage); nothing is sent to the server.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemePref, string> = { system: "Theme: match device", light: "Theme: light", dark: "Theme: dark" };

/** Cycles System → Light → Dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    let p: ThemePref = "system";
    try { p = (localStorage.getItem(KEY) as ThemePref) || "system"; } catch {}
    setPref(p);
    // Follow the device live while on "system".
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { try { if ((localStorage.getItem(KEY) || "system") === "system") apply("system"); } catch { apply("system"); } };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" className={className} aria-label={`${LABEL[pref]}. Click to change.`} title={LABEL[pref]}
      onClick={() => {
        const n = NEXT[pref];
        setPref(n);
        try { localStorage.setItem(KEY, n); } catch {}
        apply(n);
      }}>
      <Icon className="size-4" />
    </Button>
  );
}
