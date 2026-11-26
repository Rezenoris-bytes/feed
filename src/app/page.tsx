import Link from "next/link";
import { ArrowRight, EyeOff, MessageSquarePlus, Search, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getSetting } from "@/server/admin";

export const dynamic = "force-dynamic";

/** Public home for employees. No login exists for employees. */
export default async function Home() {
  const company = await getSetting("company");
  return (
    <PublicShell company={company.name}>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Speak up safely</h1>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">Raise a concern, report a problem or share an idea. No login, and nothing that identifies you is recorded.</p>
      </div>
      {company.supportText && <div className="mx-auto mb-6 max-w-2xl rounded-lg border bg-muted/40 p-4 text-sm">{company.supportText}</div>}
      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
        <HomeCard href="/submit" icon={<MessageSquarePlus className="size-6" />} title="Submit feedback" text="Takes about two minutes. You'll get a reference and a secret key to follow up." primary />
        <HomeCard href="/track" icon={<Search className="size-6" />} title="Track my feedback" text="See progress, read replies and add information using your reference and key." />
      </div>
      <Card className="mx-auto mt-8 max-w-2xl">
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="size-4 text-primary" /> How your privacy is protected</div>
          <p className="flex gap-2"><EyeOff className="mt-0.5 size-4 shrink-0" /> No account, name, email, IP address or device details are stored. Nobody, including administrators, can find out who sent feedback.</p>
          <p className="flex gap-2"><EyeOff className="mt-0.5 size-4 shrink-0" /> Location, author details and file names are removed from photos and PDFs you attach.</p>
          <p className="flex gap-2"><EyeOff className="mt-0.5 size-4 shrink-0" /> What you write can still identify you. Leave out details only you would know.</p>
        </CardContent>
      </Card>
      <p className="mt-8 text-center text-xs text-muted-foreground"><Link href="/login" className="hover:underline">Staff sign in</Link></p>
    </PublicShell>
  );
}

function HomeCard({ href, icon, title, text, primary }: { href: string; icon: React.ReactNode; title: string; text: string; primary?: boolean }) {
  return (
    <Link href={href} className={`group rounded-xl border p-5 transition-colors hover:bg-accent/50 ${primary ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="mb-3 text-primary">{icon}</div>
      <div className="flex items-center gap-2 font-semibold">{title}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
