"use client";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { MfaForm } from "@/components/auth/mfa-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function MfaSetupPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/mfa", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setSecret(d.secret); })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AuthCard title="Set up two-step verification" description="Required for Super Admin accounts.">
      <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Aegis…).</li>
        <li>Add an account and enter this setup key:</li>
      </ol>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : secret ? (
        <code className="mb-5 block break-all rounded-md border bg-muted px-3 py-2.5 text-center font-mono text-sm tracking-wider">{secret.match(/.{1,4}/g)?.join(" ")}</code>
      ) : <Skeleton className="mb-5 h-10 w-full" />}
      <p className="mb-3 text-sm text-muted-foreground">3. Enter the code the app shows.</p>
      <MfaForm />
    </AuthCard>
  );
}
