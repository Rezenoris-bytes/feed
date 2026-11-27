"use client";
import { useEffect } from "react";

/**
 * If the browser restores this page from its back/forward cache (e.g. Back after signing out or locking),
 * reload it so the server checks the session again instead of showing a stale copy.
 */
export function FreshOnBack() {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}

/** Ends the page completely: a full navigation drops every page the app kept in memory, so Back can't show them. */
export function hardNavigate(url: string) {
  window.location.replace(url);
}
