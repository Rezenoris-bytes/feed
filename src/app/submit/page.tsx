import { EyeOff } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { SubmitForm } from "@/components/feedback/submit-form";
import { formOptions } from "@/server/feedback";
import { getSetting } from "@/server/admin";

// Reads live settings (access code) on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Submit feedback" };

export default async function SubmitPage() {
  const [anon, company, options] = await Promise.all([getSetting("anonymous"), getSetting("company"), formOptions()]);
  return (
    <PublicShell company={company.name}>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground"><EyeOff className="size-3.5" /> No login · no name · no tracking</div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Submit feedback</h1>
        <p className="mt-1.5 text-muted-foreground">Nothing about you is recorded, so nobody can find out who sent it, not even administrators.</p>
      </div>
      <SubmitForm {...options} requireCode={!!anon.accessCode} />
    </PublicShell>
  );
}
