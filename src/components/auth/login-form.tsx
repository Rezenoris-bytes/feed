"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, postJson } from "@/components/auth/auth-card";

export function LoginForm({ logo, company }: { logo: string | null; company: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const f = new FormData(e.currentTarget);
    try {
      const { next } = await postJson("/api/auth/login", { email: f.get("email"), password: f.get("password") });
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in" description="Staff only. Use your company account." logo={logo} company={company}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" required /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Sign in</Button>
      </form>
      {(
        <div className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
          Employee? No sign-in needed.{" "}
          <Link href="/submit" className="font-medium text-primary underline-offset-4 hover:underline">Send feedback</Link>
          <span className="mx-1.5">·</span>
          <Link href="/track" className="underline-offset-4 hover:underline">Track it</Link>
        </div>
      )}
    </AuthCard>
  );
}
