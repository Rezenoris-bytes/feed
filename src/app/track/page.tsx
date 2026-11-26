import { PublicShell } from "@/components/shell/public-shell";
import { TrackForm } from "@/components/feedback/track-form";
import { getSetting } from "@/server/admin";

// Reads live settings on every request (the anonymous switch must apply immediately).
export const dynamic = "force-dynamic";

export const metadata = { title: "Track anonymous feedback" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const company = await getSetting("company");
  const { ref } = await searchParams;
  return (
    <PublicShell company={company.name}>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Track anonymous feedback</h1>
        <p className="mb-6 mt-1.5 text-muted-foreground">Enter the reference and secret key you saved when you submitted.</p>
        <TrackForm initialRef={ref?.match(/^FB-[2-9A-Z-]{14}$/) ? ref : ""} />
      </div>
    </PublicShell>
  );
}
