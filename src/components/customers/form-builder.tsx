"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { FIELD_ICON } from "./icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/feedback/bits";
import { FIELD_LABEL, FIELD_TYPES, FormInput, newFieldId, type CustomerField, type FieldType } from "@/lib/customer-forms";
import { cn } from "@/lib/utils";

type Draft = { title: string; intro: string; thanks: string; fields: CustomerField[] };

export async function api(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error === "Invalid input" ? "Please check the highlighted fields" : d.error ?? "Something went wrong");
  return d;
}

/** Edit the questions of a form. Saves the whole form at once. */
export function FormBuilder({ id, initial, sent }: { id: string; initial: Draft; sent: number }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const upd = (i: number, patch: Partial<CustomerField>) => setD((x) => ({ ...x, fields: x.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const move = (i: number, by: number) => setD((x) => {
    const f = [...x.fields]; const j = i + by; if (j < 0 || j >= f.length) return x;
    [f[i], f[j]] = [f[j], f[i]]; return { ...x, fields: f };
  });
  const add = (type: FieldType) => setD((x) => ({ ...x, fields: [...x.fields, {
    id: newFieldId(), type, label: "", help: "", required: false,
    options: type === "choice" || type === "multi" ? ["Option 1", "Option 2"] : [],
  }] }));

  async function save() {
    const p = FormInput.safeParse(d);
    if (!p.success) return toast.error(p.error.issues[0]?.message ?? "Please check the form");
    setBusy(true);
    try { await api(`/api/customer-forms/${id}`, "PATCH", p.data); toast.success("Saved"); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4 pb-20">
      {sent > 0 && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">Already sent to {sent}. Changes apply to links that haven't been answered yet.</p>}

      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <div className="space-y-1.5"><Label htmlFor="title">Form title</Label>
          <Input id="title" value={d.title} maxLength={120} onChange={(e) => setD({ ...d, title: e.target.value })} className="text-base font-semibold" /></div>
        <div className="space-y-1.5"><Label htmlFor="intro">Message at the top <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="intro" value={d.intro} maxLength={600} rows={2} onChange={(e) => setD({ ...d, intro: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="thanks">Thank-you message <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="thanks" value={d.thanks} maxLength={300} placeholder="Thank you for your feedback." onChange={(e) => setD({ ...d, thanks: e.target.value })} /></div>
      </section>

      {d.fields.map((f, i) => {
        const Icon = FIELD_ICON[f.type];
        return (
          <section key={f.id} className="rounded-xl border bg-card p-4 sm:p-5" aria-label={`Question ${i + 1}`}>
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>
              <NativeSelect aria-label="Question type" value={f.type} className="w-40"
                onChange={(e) => { const t = e.target.value as FieldType; upd(i, { type: t, options: (t === "choice" || t === "multi") && f.options.length < 2 ? ["Option 1", "Option 2"] : f.options }); }}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_LABEL[t]}</option>)}
              </NativeSelect>
              <div className="ml-auto flex items-center">
                <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === d.fields.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Duplicate" onClick={() => setD((x) => ({ ...x, fields: [...x.fields.slice(0, i + 1), { ...f, id: newFieldId() }, ...x.fields.slice(i + 1)] }))}><Copy /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Delete question" disabled={d.fields.length === 1}
                  onClick={() => setD((x) => ({ ...x, fields: x.fields.filter((_, j) => j !== i) }))}><Trash2 /></Button>
              </div>
            </div>
            <Input aria-label="Question" placeholder="Type the question" value={f.label} maxLength={200} onChange={(e) => upd(i, { label: e.target.value })}
              className={cn("mt-3 h-10 text-base", !f.label.trim() && "border-dashed")} />
            <Input aria-label="Hint" placeholder="Hint (optional)" value={f.help} maxLength={200} onChange={(e) => upd(i, { help: e.target.value })} className="mt-2 h-8 text-sm" />

            {(f.type === "choice" || f.type === "multi") && (
              <div className="mt-3 space-y-2">
                {f.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className={cn("size-3.5 shrink-0 border", f.type === "choice" ? "rounded-full" : "rounded-sm")} />
                    <Input aria-label={`Option ${k + 1}`} value={o} maxLength={80} className="h-8"
                      onChange={(e) => upd(i, { options: f.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove option" disabled={f.options.length <= 2}
                      onClick={() => upd(i, { options: f.options.filter((_, m) => m !== k) })}><X /></Button>
                  </div>
                ))}
                {f.options.length < 15 && <Button type="button" variant="ghost" size="sm" onClick={() => upd(i, { options: [...f.options, `Option ${f.options.length + 1}`] })}><Plus /> Add option</Button>}
              </div>
            )}
            {f.type === "rating" && <p className="mt-3 flex gap-0.5 text-amber-400" aria-hidden>{[1, 2, 3, 4, 5].map((s) => <Star key={s} className="size-5" />)}</p>}

            <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={f.required} onCheckedChange={(v) => upd(i, { required: v })} /> Required
            </label>
          </section>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className="w-full border-dashed" />}><Plus /> Add question</DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {FIELD_TYPES.map((t) => { const I = FIELD_ICON[t]; return <DropdownMenuItem key={t} onClick={() => add(t)}><I /> {FIELD_LABEL[t]}</DropdownMenuItem>; })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* sticky save bar */}
      <div className={cn("fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 transition md:bottom-6", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <div className="flex items-center gap-3 rounded-lg border bg-popover px-4 py-2 shadow-lg">
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <Button variant="ghost" size="sm" onClick={() => setD(initial)}>Undo</Button>
          <Button size="sm" onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save</Button>
        </div>
      </div>
    </div>
  );
}
