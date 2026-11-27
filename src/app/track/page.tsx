import { Search } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { TrackForm } from "@/components/feedback/track-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Track feedback" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <PublicShell>
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Search className="size-5" /></span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Track feedback</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Use the reference and key you saved.</p>
          <TrackForm initialRef={ref?.match(/^FB-[2-9A-Z-]{14}$/) ? ref : ""} />
        </div>
      </div>
    </PublicShell>
  );
}
