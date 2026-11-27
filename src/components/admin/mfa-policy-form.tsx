"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Super Admin switch for "authenticator code required at sign-in". Turning it off needs password + current code. */
export function MfaPolicyForm({ required, enrolled }: { required: boolean; enrolled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(required);
  const [target, setTarget] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const turningOff = target === false;
  const needCode = turningOff && enrolled;

  function close() { setTarget(null); setPassword(""); setCode(""); }

  async function confirm() {
    if (target === null) return;
    setBusy(true);
    const res = await fetch("/api/admin/security/mfa", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: target, password, code: needCode ? code : undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Could not change the setting");
    setOn(target);
    close();
    toast.success(target ? "Authenticator codes are required again" : "Authenticator codes turned off");
    if (d.next) router.replace(d.next); else router.refresh();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /> Two-step verification for Super Admins</CardTitle>
        <CardDescription>When on, Super Admins enter a code from an authenticator app every time they sign in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">{on ? "On: code required at sign-in" : "Off: password only"}</div>
            <div className="text-xs text-muted-foreground">Changing this needs your password{on && enrolled ? " and a current code" : ""}. Every change is recorded in the audit log.</div>
          </div>
          <Switch checked={on} onCheckedChange={(v) => setTarget(v)} aria-label="Require authenticator code for Super Admins" />
        </label>
        {!on && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Anyone who learns a Super Admin password can now sign in with full control. Turn this back on as soon as possible.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{turningOff ? "Turn off two-step verification?" : "Turn on two-step verification"}</DialogTitle>
            <DialogDescription>
              {turningOff
                ? "Super Admins will sign in with only a password. If a password is stolen or guessed, the attacker gets full control of the system."
                : enrolled ? "You'll be asked for a code from your authenticator app straight away." : "You'll set up an authenticator app straight away."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="pw">Your password</Label>
              <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {needCode && (
              <div className="space-y-2"><Label htmlFor="code">Current authenticator code</Label>
                <Input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="font-mono tracking-widest" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button variant={turningOff ? "destructive" : "default"} disabled={busy || !password || (needCode && code.length !== 6)} onClick={confirm}>
              {busy && <Loader2 className="animate-spin" />} {turningOff ? "Turn off" : "Turn on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
