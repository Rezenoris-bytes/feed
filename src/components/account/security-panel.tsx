"use client";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SecurityPanel({ otherSessions }: { otherSessions: number }) {
  const [busy, setBusy] = useState(false);
  const [others, setOthers] = useState(otherSessions);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("next") !== f.get("confirm")) return toast.error("New passwords don't match");
    setBusy(true);
    const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: f.get("current"), next: f.get("next") }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Could not change password");
    form.reset(); setOthers(0);
    toast.success("Password changed. Other devices were signed out.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Change password</CardTitle><CardDescription>At least 12 characters. A passphrase of a few words works well.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" autoComplete="current-password" required /></div>
            <div className="space-y-2"><Label htmlFor="next">New password</Label><Input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required /></div>
            <div className="space-y-2"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></div>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Update password</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Signed-in devices</CardTitle><CardDescription>{others === 0 ? "Only this device is signed in." : `${others} other device${others > 1 ? "s are" : " is"} signed in.`}</CardDescription></CardHeader>
        <CardContent>
          <Button variant="outline" disabled={others === 0} onClick={async () => {
            const r = await fetch("/api/auth/password", { method: "DELETE" });
            if (r.ok) { setOthers(0); toast.success("Signed out of other devices"); } else toast.error("Could not sign out other devices");
          }}><LogOut /> Sign out other devices</Button>
        </CardContent>
      </Card>
    </div>
  );
}
