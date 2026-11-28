"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, FilePlus2, Loader2, MoreHorizontal, Plus, Rocket, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TEMPLATES } from "@/lib/customer-forms";
import { api } from "./form-builder";

/** "New form" → pick a template → opens the builder. */
export function NewFormButton({ base }: { base: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  async function create(key: string) {
    setBusy(key);
    try {
      const { id } = await api("/api/customer-forms", "POST", TEMPLATES.find((t) => t.key === key)!.build());
      router.push(`${base}/${id}?tab=questions`);
    } catch (e) { toast.error((e as Error).message); setBusy(null); }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> New form</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New customer form</DialogTitle><DialogDescription>Pick a starting point. You can change every question.</DialogDescription></DialogHeader>
          <div className="grid gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.key} type="button" disabled={!!busy} onClick={() => create(t.key)}
                className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-60">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">{busy === t.key ? <Loader2 className="size-5 animate-spin" /> : <FilePlus2 className="size-5" />}</span>
                <span><span className="block font-medium">{t.title}</span><span className="text-sm text-muted-foreground">{t.summary}</span></span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Publish / back to draft / archive / delete. */
export function FormStatusActions({ id, status, sent, base }: { id: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; sent: number; base: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(s: string, ok: string) {
    setBusy(true);
    try { await api(`/api/customer-forms/${id}`, "PATCH", { status: s }); toast.success(ok); router.refresh(); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm("Delete this form? This can't be undone.")) return;
    try { await api(`/api/customer-forms/${id}`, "DELETE"); toast.success("Form deleted"); router.push(base); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && <Button onClick={() => set("ACTIVE", "Published. You can send it now.")} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Rocket />} Publish</Button>}
      {status === "ARCHIVED" && <Button variant="outline" onClick={() => set("ACTIVE", "Restored")} disabled={busy}><Undo2 /> Restore</Button>}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More form actions" />}><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {status === "ACTIVE" && <DropdownMenuItem onClick={() => set("DRAFT", "Moved back to draft. Open links stop working until you publish again.")}><Undo2 /> Back to draft</DropdownMenuItem>}
          {status !== "ARCHIVED" && <DropdownMenuItem onClick={() => set("ARCHIVED", "Archived")}><Archive /> Archive</DropdownMenuItem>}
          {sent === 0 && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={remove}><Trash2 /> Delete</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
