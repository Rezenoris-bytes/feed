"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FreshOnBack, hardNavigate } from "@/components/shell/fresh-on-back";

export function TrackForm({ initialRef }: { initialRef: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card>
      <CardContent className="pt-6">
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
            <Input id="reference" name="reference" defaultValue={initialRef} placeholder="FB-XXXX-XXXX-XXXX" autoComplete="off" required className="font-mono uppercase" /></div>
          <div className="space-y-2"><Label htmlFor="key">Secret key</Label>
            <Input id="key" name="key" type="password" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autoComplete="off" required className="font-mono uppercase" /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Open</Button>
          <p className="text-xs text-muted-foreground">Access lasts 30 minutes on this device, then you&apos;ll need the key again.</p>
        </form>
      </CardContent>
    </Card>
  );
}

export function LockButton() {
  return (
    <>
    <FreshOnBack />
    <Button variant="outline" size="sm" onClick={async () => { await fetch("/api/anonymous/track", { method: "DELETE" }); hardNavigate("/track"); }}>
      <LogOut /> Lock
    </Button>
    </>
  );
}
