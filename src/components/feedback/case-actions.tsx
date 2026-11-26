"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/feedback-meta";
import { NativeSelect } from "./bits";

async function act(id: string, body: object) {
  const res = await fetch(`/api/cases/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Action failed");
}

export function StatusAction({ id, current, targets, canOverride }: { id: string; current: Status; targets: Status[]; canOverride: boolean }) {
  const router = useRouter();
  const options = canOverride ? STATUSES.filter((s) => s !== current) : targets;
  const [to, setTo] = useState<Status | "">("");
  const [busy, setBusy] = useState(false);
  const override = !!to && canOverride && !targets.includes(to);

  if (options.length === 0) return <p className="text-sm text-muted-foreground">This case is final. No further status changes.</p>;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="to">Move to</Label>
        <NativeSelect id="to" value={to} onChange={(e) => setTo(e.target.value as Status)}>
          <option value="" disabled>Choose status</option>
          {targets.length > 0 && <optgroup label="Next steps">{targets.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</optgroup>}
          {canOverride && <optgroup label="Override (Super Admin)">{options.filter((s) => !targets.includes(s)).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</optgroup>}
        </NativeSelect>
      </div>
      {override && <p className="text-xs text-amber-700 dark:text-amber-300">This is an override and will be recorded in the audit log.</p>}
      <Button className="w-full" disabled={!to || busy}
        onClick={async () => {
          setBusy(true);
          try { await act(id, { action: "status", to }); toast.success("Status updated"); setTo(""); router.refresh(); }
          catch (e) { toast.error((e as Error).message); }
          setBusy(false);
        }}>
        {busy && <Loader2 className="animate-spin" />} Update status
      </Button>
    </div>
  );
}

export function AssignAction({ id, staff, currentId }: { id: string; staff: { id: string; displayName: string; department: { name: string } | null }[]; currentId?: string }) {
  const router = useRouter();
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <NativeSelect value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assign to">
        <option value="" disabled>Assign to…</option>
        {staff.filter((s) => s.id !== currentId).map((s) => <option key={s.id} value={s.id}>{s.displayName}{s.department ? ` · ${s.department.name}` : ""}</option>)}
      </NativeSelect>
      <Button variant="secondary" disabled={!who || busy} onClick={async () => {
        setBusy(true);
        try { await act(id, { action: "assign", assigneeId: who }); toast.success("Assigned"); setWho(""); router.refresh(); }
        catch (e) { toast.error((e as Error).message); }
        setBusy(false);
      }}>{busy ? <Loader2 className="animate-spin" /> : "Assign"}</Button>
    </div>
  );
}
