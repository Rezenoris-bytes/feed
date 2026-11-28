"use client";
import { useState } from "react";
import { MessageSquareLock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Company logo if uploaded, otherwise (or if the image can't load) the default Feed mark. Never a broken image. */
export function BrandMark({ logo, company, size = "md", className }: { logo?: string | null; company: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  if (logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local, already-optimised PNG
      <img src={logo} alt={`${company} logo`} onError={() => setFailed(true)}
        className={cn(box, "shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border", className)} />
    );
  }
  return (
    <div className={cn(box, "grid shrink-0 place-items-center rounded-full bg-primary/15 text-primary", className)} aria-hidden>
      <MessageSquareLock className={size === "sm" ? "size-4" : "size-5"} />
    </div>
  );
}
