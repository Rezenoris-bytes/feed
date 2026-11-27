"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { manage } from "./client";

export function CompanyForm({ value }: { value: { name: string; supportText: string } }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader><CardTitle>Organisation</CardTitle><CardDescription>Shown in the sidebar and on the employee home page.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label htmlFor="cn">Company name</Label><Input id="cn" value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="st">Message to employees</Label>
          <Textarea id="st" rows={3} maxLength={300} value={v.supportText} placeholder="e.g. For urgent safety issues, also call the site manager." onChange={(e) => setV({ ...v, supportText: e.target.value })} /></div>
        <Button disabled={busy || !v.name.trim()} onClick={async () => {
          setBusy(true);
          try { await manage({ action: "settings.set", key: "company", value: v }); toast.success("Saved"); router.refresh(); } catch (e) { toast.error((e as Error).message); }
          setBusy(false);
        }}>{busy && <Loader2 className="animate-spin" />} Save</Button>
      </CardContent>
    </Card>
  );
}

const EVENTS = [
  ["newFeedback", "New feedback", "When something is sent"],
  ["highPriority", "High-priority feedback", "Sensitive, High or Critical"],
  ["assignment", "Assignments", "To the assigned reviewer"],
  ["messages", "Sender replies", "To the assigned reviewer"],
] as const;
type N = Record<(typeof EVENTS)[number][0], boolean>;

export function NotificationForm({ value }: { value: N }) {
  const [v, setV] = useState(value);
  async function toggle(k: keyof N, on: boolean) {
    const next = { ...v, [k]: on };
    setV(next);
    try { await manage({ action: "settings.set", key: "notifications", value: next }); } catch (e) { setV(v); toast.error((e as Error).message); }
  }
  return (
    <Card>
      <CardHeader><CardTitle>In-app notifications</CardTitle><CardDescription>Notifications contain only the reference number and event. Never feedback text or names.</CardDescription></CardHeader>
      <CardContent className="divide-y">
        {EVENTS.map(([k, label, hint]) => (
          <label key={k} className="flex items-center justify-between gap-4 py-3">
            <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
            <Switch checked={v[k]} onCheckedChange={(on) => toggle(k, on)} />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

type A = { accessCode: string; hourlyLimit: number };

export function AnonymousForm({ value, origin }: { value: A; origin: string }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "23456789ABCDEFGHJKMNPQRSTUVWXYZ"[b % 31]).join("").replace(/(.{4})/, "$1-");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee submissions</CardTitle>
        <CardDescription>Employees never sign in. Nothing about the sender is recorded, so nobody, including a Super Admin, can find out who sent feedback.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Employee page: <span className="font-mono">{origin}/</span>. Share it as a link or QR code.
        </div>
        <div className="space-y-2">
          <Label htmlFor="ac">Access code</Label>
          <div className="flex gap-2">
            <Input id="ac" value={v.accessCode} maxLength={40} placeholder="Empty = no code required" className="font-mono uppercase"
              onChange={(e) => setV({ ...v, accessCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} />
            <Button type="button" variant="outline" onClick={() => setV({ ...v, accessCode: randomCode() })}>Generate</Button>
          </div>
          <p className="text-xs text-muted-foreground">Print it on staff notice boards next to the QR code. It keeps out people who only found the link. Change it if it leaks.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hl">Maximum anonymous submissions per hour (whole company)</Label>
          <Input id="hl" type="number" min={1} max={1000} value={v.hourlyLimit} className="w-32" onChange={(e) => setV({ ...v, hourlyLimit: Number(e.target.value) || 1 })} />
          <p className="text-xs text-muted-foreground">Anonymous senders can&apos;t be limited one by one, so this caps the total to stop floods.</p>
        </div>
        <Button disabled={busy} onClick={async () => {
          setBusy(true);
          try { await manage({ action: "settings.set", key: "anonymous", value: v }); toast.success("Saved"); router.refresh(); } catch (e) { toast.error((e as Error).message); }
          setBusy(false);
        }}>{busy && <Loader2 className="animate-spin" />} Save</Button>
      </CardContent>
    </Card>
  );
}

export function LogoForm({ logo, company }: { logo: string | null; company: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(logo);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB");
    setBusy(true);
    const fd = new FormData(); fd.append("logo", file);
    const res = await fetch("/api/admin/branding", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Upload failed");
    setPreview(`/api/branding/logo?v=${d.logoVersion}`);
    toast.success("Logo updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Company logo</CardTitle><CardDescription>Shown in the sidebar, on the sign-in page and on the employee pages. PNG, JPG or WEBP, up to 2 MB. Square images with a transparent background look best.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-20 shrink-0 place-items-center rounded-xl border bg-white p-2">
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt={`${company} logo`} className="max-h-full max-w-full object-contain" />
            : <span className="text-xs text-muted-foreground">No logo</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button onClick={() => input.current?.click()} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {preview ? "Replace logo" : "Upload logo"}</Button>
          {preview && (
            <Button variant="outline" disabled={busy} onClick={async () => {
              const r = await fetch("/api/admin/branding", { method: "DELETE" });
              if (r.ok) { setPreview(null); toast.success("Logo removed"); router.refresh(); } else toast.error("Could not remove logo");
            }}>Remove</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
