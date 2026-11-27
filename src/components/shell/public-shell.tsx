import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme";
import { getSetting } from "@/server/admin";
import { getBranding, logoUrl } from "@/server/branding";
import { BrandMark } from "./brand-mark";

/** Layout for no-login pages (home / submit / track). No user info, no notifications. Reads company name + logo itself. */
export async function PublicShell({ children, nav = true }: { company?: string; children: React.ReactNode; nav?: boolean }) {
  const [company, branding] = await Promise.all([getSetting("company"), getBranding()]);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark logo={logoUrl(branding)} company={company.name} size="sm" />
            <span className="truncate font-semibold">{company.name}</span>
          </Link>
          {nav && (
            <nav className="ml-auto flex shrink-0 items-center gap-0.5 text-sm">
              <Link href="/submit" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground sm:px-2.5">Submit</Link>
              <Link href="/track" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground sm:px-2.5">Track</Link>
              <Link href="/login" className="hidden rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground sm:inline sm:px-2.5">Staff</Link>
              <ThemeToggle />
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">{children}</main>
    </div>
  );
}
