import { notFound } from "next/navigation";
import { Link2Off } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { CustomerFormView } from "@/components/customers/customer-form-view";
import { openShare } from "@/server/customer-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Feedback", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Open link: anyone with it can answer. Name and contact details are optional. */
export default async function OpenFormPage({ params }: { params: Promise<{ code: string }> }) {
  const link = await openShare((await params).code);
  if (!link) notFound();
  return (
    <PublicShell nav={false}>
      {link.state === "open" ? (
        <CustomerFormView mode="share" postUrl={`/api/form/${(await params).code}`} form={link.form} />
      ) : (
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Link2Off className="size-6" /></span>
          <h1 className="mt-4 text-xl font-bold">This form isn&apos;t available</h1>
          <p className="mt-1 text-sm text-muted-foreground">Please try again later or contact us.</p>
        </div>
      )}
    </PublicShell>
  );
}
