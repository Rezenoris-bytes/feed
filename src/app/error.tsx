"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown instead of a crash when a page can't load (for example the database is busy for a moment after a deploy). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const retry = () => { setBusy(true); router.refresh(); reset(); setTimeout(() => setBusy(false), 1500); };

  // One automatic retry after a few seconds: most hiccups are over by then.
  useEffect(() => { const t = setTimeout(retry, 4000); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><RotateCw className="size-6" /></span>
        <h1 className="mt-4 text-xl font-bold">Just a moment</h1>
        <p className="mt-1 text-sm text-muted-foreground">We couldn&apos;t load this page. It usually works again in a few seconds.</p>
        <Button className="mt-5" onClick={retry} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RotateCw />} Try again</Button>
      </div>
    </div>
  );
}
