"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FreshOnBack, hardNavigate } from "@/components/shell/fresh-on-back";

export function TrackForm({ initialRef }: { initialRef: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setError("");
      const f = new FormData(e.currentTarget);
      const res = await fetch("/api/anonymous/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: f.get("reference"), key: f.get("key") }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Check the reference and key"); setBusy(false); return; }
      router.push(d.next);
    }}>
      <div className="space-y-2"><Label htmlFor="reference">Reference</Label>
        <Input id="reference" name="reference" defaultValue={initialRef} placeholder="FB-XXXX-XXXX-XXXX" autoComplete="off" required className="h-11 font-mono uppercase" /></div>
      <div className="space-y-2"><Label htmlFor="key">Secret key</Label>
        <Input id="key" name="key" type="password" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autoComplete="off" required className="h-11 font-mono uppercase" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Open</Button>
      <p className="text-center text-xs text-muted-foreground">Stays open 30 minutes on this device.</p>
    </form>
  );
}

export function LockButton() {
  return (
    <>
      <FreshOnBack />
      <Button variant="outline" size="sm" onClick={async () => { await fetch("/api/anonymous/track", { method: "DELETE" }); hardNavigate("/track"); }}>
        <Lock /> Lock
      </Button>
    </>
  );
}
