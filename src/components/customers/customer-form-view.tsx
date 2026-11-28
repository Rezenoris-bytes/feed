"use client";
import { useState } from "react";
import { Check, CheckCircle2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CustomerField } from "@/lib/customer-forms";

type Answer = string | number | string[];
type Props = { token: string; customerName: string; machine: string | null; form: { title: string; intro: string; thanks: string; fields: CustomerField[] } };

/** What the customer sees: a short, friendly form. One submit per link. */
export function CustomerFormView({ token, customerName, machine, form }: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = (id: string, v: Answer) => { setAnswers((a) => ({ ...a, [id]: v })); if (error?.field === id) setError(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = form.fields.find((f) => f.required && (answers[f.id] === undefined || answers[f.id] === "" || (Array.isArray(answers[f.id]) && !(answers[f.id] as string[]).length)));
    if (missing) { setError({ text: `Please answer "${missing.label}"`, field: missing.id }); document.getElementById("q-" + missing.id)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/f/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) { setDone(d.thanks || "Thank you for your feedback."); window.scrollTo({ top: 0 }); }
      else setError({ text: d.error ?? "Something went wrong. Please try again.", field: d.field });
    } catch { setError({ text: "No connection. Please try again." }); }
    setBusy(false);
  }

  if (done) return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="size-6" /></span>
      <h1 className="mt-4 text-xl font-bold">{`Thank you, ${customerName}`}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{done}</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4" noValidate>
      <header className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-sm text-muted-foreground">{`Hi ${customerName}`}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{form.title}</h1>
        {machine && <p className="mt-2 inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{machine}</p>}
        {form.intro && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{form.intro}</p>}
      </header>

      {form.fields.map((f, i) => (
        <fieldset key={f.id} id={"q-" + f.id} className={cn("rounded-xl border bg-card p-5 shadow-sm", error?.field === f.id && "border-destructive ring-2 ring-destructive/20")}>
          <legend className="sr-only">{f.label}</legend>
          <p className="font-medium" aria-hidden><span className="mr-1.5 text-muted-foreground">{i + 1}.</span>{f.label}{f.required && <span className="ml-0.5 text-destructive">*</span>}</p>
          {f.help && <p className="mt-0.5 text-xs text-muted-foreground">{f.help}</p>}
          <div className="mt-3"><FieldInput f={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} /></div>
        </fieldset>
      ))}

      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.text}</p>}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Send answers
      </Button>
      <p className="text-center text-xs text-muted-foreground">This link is personal to you and works once.</p>
    </form>
  );
}

function FieldInput({ f, value, onChange }: { f: CustomerField; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const pill = (on: boolean) => cn("flex min-h-11 items-center gap-2 rounded-md border px-3.5 py-2 text-left text-sm transition-colors",
    on ? "border-primary bg-primary/10 text-foreground" : "hover:bg-accent");
  switch (f.type) {
    case "short": return <Input aria-label={f.label} value={(value as string) ?? ""} maxLength={300} onChange={(e) => onChange(e.target.value)} className="h-11" />;
    case "long": return <Textarea aria-label={f.label} value={(value as string) ?? ""} maxLength={5000} rows={4} onChange={(e) => onChange(e.target.value)} />;
    case "rating": {
      const n = (value as number) ?? 0;
      return (
        <div role="radiogroup" aria-label={f.label} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={n === s} aria-label={`${s} of 5`} onClick={() => onChange(s)}
              className="grid size-11 place-items-center rounded-md transition-transform hover:scale-110">
              <Star className={cn("size-8", s <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
      );
    }
    case "yesno": return (
      <div role="radiogroup" aria-label={f.label} className="grid max-w-xs grid-cols-2 gap-2">
        {["Yes", "No"].map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cn(pill(value === o), "justify-center font-medium")}>{o}</button>)}
      </div>
    );
    case "choice": return (
      <div role="radiogroup" aria-label={f.label} className="grid gap-2 sm:grid-cols-2">
        {f.options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={pill(value === o)}>
            <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", value === o && "border-primary")}>{value === o && <span className="size-2 rounded-full bg-primary" />}</span>{o}
          </button>
        ))}
      </div>
    );
    case "multi": {
      const arr = (value as string[]) ?? [];
      return (
        <div role="group" aria-label={f.label} className="grid gap-2 sm:grid-cols-2">
          {f.options.map((o) => {
            const on = arr.includes(o);
            return (
              <button key={o} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])} className={pill(on)}>
                <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>{on && <Check className="size-3" />}</span>{o}
              </button>
            );
          })}
        </div>
      );
    }
  }
}
