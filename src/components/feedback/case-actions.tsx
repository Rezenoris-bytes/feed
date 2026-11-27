"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/feedback-meta";
import { NativeSelect, TONE_DOT, toneOf } from "./bits";

async function act(id: string, body: object) {
  const res = await fetch(`/api/cases/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Action failed");
}

/** One tap per status. Disabled buttons are moves not allowed from here (Super Admin may override any). */
export function StatusAction({ id, current, targets, canOverride }: { id: string; current: Status; targets: Status[]; canOverride: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Status | null>(null);
  async function move(to: Status) {
    setBusy(to);
    try { await act(id, { action: "status", to }); toast.success(`Moved to ${STATUS_LABEL[to]}`); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }
  return (
    <div role="group" aria-label="Set status" className="grid grid-cols-2 gap-2">
      {STATUSES.map((s) => {
        const isCurrent = s === current;
        const allowed = targets.includes(s) || (canOverride && !isCurrent);
        return (
          <button key={s} type="button" disabled={isCurrent || !allowed || !!busy} onClick={() => move(s)} aria-pressed={isCurrent}
            className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
              isCurrent ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : allowed ? "hover:border-primary/40 hover:bg-accent" : "opacity-40",
              s === "CLOSED" && "col-span-2")}>
            {busy === s ? <Loader2 className="size-3.5 animate-spin" /> : <span className={cn("size-2 rounded-full", TONE_DOT[toneOf(s)])} />}
            {STATUS_LABEL[s]}
            {isCurrent && <span className="ml-auto text-[10px] font-normal uppercase tracking-wide">Now</span>}
          </button>
        );
      })}
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
        <option value="" disabled>{currentId ? "Reassign to…" : "Assign to…"}</option>
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
