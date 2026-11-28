import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Link2Off } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { CustomerFormView } from "@/components/customers/customer-form-view";
import { openLink } from "@/server/customer-forms";

export const dynamic = "force-dynamic";
// The token is the key to this page: keep it out of search engines and out of Referer headers.
export const metadata = { title: "Feedback", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const CLOSED = {
  replied: { icon: CheckCircle2, title: "Already answered", text: "Thank you, we have your answers." },
  expired: { icon: Clock, title: "This link has expired", text: "Please ask us for a new link." },
  withdrawn: { icon: Link2Off, title: "This link is no longer active", text: "Please ask us for a new link." },
  unavailable: { icon: Link2Off, title: "This form isn't available", text: "Please try again later or contact us." },
};

export default async function CustomerFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await openLink(token, true);
  if (!link) notFound();
  return (
    <PublicShell nav={false}>
      {link.state === "open" ? (
        <CustomerFormView mode="personal" postUrl={`/api/f/${token}`} customerName={link.send.customerName} machine={link.send.machine} form={link.form} />
      ) : (() => {
        const c = CLOSED[link.state]; const Icon = c.icon;
        return (
          <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
            <h1 className="mt-4 text-xl font-bold">{c.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{link.state === "replied" && link.thanks ? link.thanks : c.text}</p>
          </div>
        );
      })()}
    </PublicShell>
  );
}
