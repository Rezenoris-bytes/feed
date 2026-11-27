import Link from "next/link";
import { ArrowRight, EyeOff, Lock, MessageSquarePlus, Search, UserX } from "lucide-react";
import { PublicShell } from "@/components/shell/public-shell";
import { getSetting } from "@/server/admin";

export const dynamic = "force-dynamic";

/** Public home for employees. No login exists for employees. */
export default async function Home() {
  const company = await getSetting("company");
  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-12 text-center sm:px-10 sm:py-16">
        {/* soft brand glow */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Lock className="size-3.5 text-primary" /> 100% anonymous
        </span>
        <h1 className="mx-auto mt-5 max-w-xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Speak up. <span className="text-primary">Stay anonymous.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-balance text-muted-foreground">Share a concern or an idea. No login, no name.</p>

        <div className="mx-auto mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
          <Link href="/submit" className="group flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl">
            <span className="flex items-center gap-3"><MessageSquarePlus className="size-5" /><span className="font-semibold">Give feedback</span></span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/track" className="group flex items-center justify-between gap-3 rounded-2xl border bg-background px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <span className="flex items-center gap-3"><Search className="size-5 text-primary" /><span className="font-semibold">Track feedback</span></span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {company.supportText && <p className="mx-auto mt-6 max-w-xl rounded-xl border bg-muted/40 px-4 py-3 text-center text-sm">{company.supportText}</p>}

      <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
        {[
          { icon: UserX, title: "No login", text: "No account needed" },
          { icon: EyeOff, title: "No tracking", text: "No name, IP or device" },
          { icon: Lock, title: "Private files", text: "Photo data removed" },
        ].map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span>
            <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-center text-xs text-muted-foreground"><Link href="/login" className="hover:text-foreground hover:underline">Staff sign in</Link></p>
    </PublicShell>
  );
}
