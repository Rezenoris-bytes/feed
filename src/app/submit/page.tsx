import { Lock } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { SubmitForm } from "@/components/feedback/submit-form";
import { formOptions } from "@/server/feedback";
import { getSetting } from "@/server/admin";

// Reads live settings (access code) on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Give feedback" };

export default async function SubmitPage() {
  const [anon, options] = await Promise.all([getSetting("anonymous"), formOptions()]);
  return (
    <PublicShell>
      <div className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Give feedback</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="size-3.5 text-primary" /> Anonymous. No login.</p>
      </div>
      <SubmitForm {...options} requireCode={!!anon.accessCode} />
    </PublicShell>
  );
}
