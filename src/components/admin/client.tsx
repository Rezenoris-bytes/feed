"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/feedback/bits";

export async function manage(body: object): Promise<{ tempPassword?: string }> {
  const res = await fetch("/api/admin/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Action failed");
  return d;
}

function TempPasswordDialog({ pw, onClose }: { pw: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!pw} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>Give this to the person privately. It is shown only once. They should change it after signing in.</DialogDescription>
        </DialogHeader>
        <button onClick={() => { navigator.clipboard.writeText(pw ?? ""); toast.success("Copied"); }} className="flex items-center justify-between rounded-md border bg-muted px-4 py-3 font-mono text-sm">
          {pw} <Copy className="size-4 text-muted-foreground" />
        </button>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Dept = { id: string; name: string };

export function CreateUserButton({ role, departments, label }: { role: "HR" | "REVIEWER" | "STAFF"; departments: Dept[]; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState<string | null>(null);
  const [r, setR] = useState(role === "STAFF" ? "REVIEWER" : role);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const { tempPassword } = await manage({ action: "user.create", role: r, ...f });
      setOpen(false); setPw(tempPassword ?? null); router.refresh();
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {role === "STAFF" && (
              <div className="space-y-2"><Label htmlFor="r">Role</Label>
                <NativeSelect id="r" value={r} onChange={(e) => setR(e.target.value as typeof r)}><option value="REVIEWER">Department reviewer</option><option value="HR">HR administrator</option></NativeSelect>
              </div>
            )}
            <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" name="name" required minLength={2} /></div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
            <div className="space-y-2"><Label htmlFor="departmentId">Department</Label>
              <NativeSelect id="departmentId" name="departmentId" defaultValue="" required={r === "REVIEWER"}>
                <option value="">{r === "REVIEWER" ? "Choose department" : "None"}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </NativeSelect>
            </div>
            <DialogFooter><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create account</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <TempPasswordDialog pw={pw} onClose={() => setPw(null)} />
    </>
  );
}

export function UserRowActions({ id, active, locked }: { id: string; active: boolean; locked?: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (locked) return <span className="text-xs text-muted-foreground">Managed via CLI</span>;
  return (
    <div className="flex items-center justify-end gap-3">
      <Button size="sm" variant="ghost" disabled={busy} title="Reset password" onClick={async () => {
        if (!confirm("Reset this password? The person will be signed out everywhere.")) return;
        setBusy(true);
        try { setPw((await manage({ action: "user.resetPassword", id })).tempPassword ?? null); } catch (e) { toast.error((e as Error).message); }
        setBusy(false);
      }}><KeyRound /> <span className="hidden sm:inline">Reset</span></Button>
      <Switch checked={active} aria-label="Active" onCheckedChange={async (v) => {
        try { await manage({ action: "user.active", id, active: v }); router.refresh(); } catch (e) { toast.error((e as Error).message); }
      }} />
      <TempPasswordDialog pw={pw} onClose={() => setPw(null)} />
    </div>
  );
}

export function AddNamedItem({ kind, placeholder }: { kind: "dept" | "category"; placeholder: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await manage(kind === "dept" ? { action: "dept.create", name } : { action: "category.create", name, sensitive }); setName(""); setSensitive(false); router.refresh(); }
      catch (err) { toast.error((err as Error).message); }
      setBusy(false);
    }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="sm:max-w-xs" required minLength={2} />
      {kind === "category" && <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={sensitive} onCheckedChange={setSensitive} /> Sensitive</label>}
      <Button type="submit" variant="secondary" disabled={busy}><Plus /> Add</Button>
    </form>
  );
}

export function ToggleSwitch({ action, id, field, checked, label }: { action: "dept.update" | "category.update"; id: string; field: "active" | "sensitive"; checked: boolean; label: string }) {
  const router = useRouter();
  return <Switch checked={checked} aria-label={label} onCheckedChange={async (v) => {
    try { await manage({ action, id, [field]: v }); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
  }} />;
}
