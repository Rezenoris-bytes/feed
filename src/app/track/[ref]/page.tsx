import { redirect } from "next/navigation";
import { PublicShell } from "@/components/shell/public-shell";
import { SubmitterCaseView } from "@/components/feedback/submitter-case-view";
import { LockButton } from "@/components/feedback/track-form";
import { getSetting } from "@/server/admin";
import { getTracked } from "@/server/anonymous";

// Reads live settings on every request (the anonymous switch must apply immediately).
export const dynamic = "force-dynamic";

export const metadata = { title: "Anonymous feedback" };

export default async function TrackedCase({ params }: { params: Promise<{ ref: string }> }) {
  const company = await getSetting("company");
  const { ref } = await params;
  const fb = await getTracked(ref);
  if (!fb) redirect(`/track?ref=${encodeURIComponent(ref)}`); // no or expired unlock → ask for the key again
  return (
    <PublicShell company={company.name}>
      <SubmitterCaseView fb={fb} postUrl="/api/anonymous/messages" payload={{ reference: fb.reference }} action={<LockButton />} />
    </PublicShell>
  );
}
