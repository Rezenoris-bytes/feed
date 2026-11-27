"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, Download, FileText, ImagePlus, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_ATTACHMENTS } from "@/lib/feedback-meta";
import { NativeSelect, categoryIcon, fmtSize } from "./bits";
import { solveChallenge } from "@/lib/pow-client";

type Opt = { id: string; name: string };
type Props = {
  categories: (Opt & { sensitive: boolean })[]; priorities: (Opt & { key: string })[]; departments: Opt[];
  /** Every submission is anonymous: no login, no identity recorded; tracked with a one-time secret key. */
  requireCode?: boolean;
};
const STEPS = ["Topic", "Details", "Send"];
const URGENCY: Record<string, string> = {
  LOW: "data-[on=true]:border-slate-400 data-[on=true]:bg-slate-500/10",
  MEDIUM: "data-[on=true]:border-sky-500 data-[on=true]:bg-sky-500/10 data-[on=true]:text-sky-700 dark:data-[on=true]:text-sky-300",
  HIGH: "data-[on=true]:border-amber-500 data-[on=true]:bg-amber-500/10 data-[on=true]:text-amber-700 dark:data-[on=true]:text-amber-300",
  CRITICAL: "data-[on=true]:border-rose-500 data-[on=true]:bg-rose-500/10 data-[on=true]:text-rose-700 dark:data-[on=true]:text-rose-300",
};

export function SubmitForm({ categories, priorities, departments, requireCode = false }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [trackingKey, setTrackingKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [showDept, setShowDept] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState({
    categoryId: "", priorityId: priorities.find((p) => p.key === "MEDIUM")?.id ?? "", departmentId: "", title: "", description: "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const category = categories.find((c) => c.id === v.categoryId);
  const descLeft = Math.max(0, 20 - v.description.trim().length);

  const valid = [!!v.categoryId && !!v.priorityId, v.title.trim().length >= 1 && descLeft === 0, !requireCode || accessCode.trim().length > 0];
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  async function submit() {
    setBusy(true);
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.append(k, val));
    files.forEach((f) => fd.append("files", f));
    try {
      setChecking(true);
      const pow = await solveChallenge();
      fd.append("challenge", pow.challenge); fd.append("counter", pow.counter); fd.append("accessCode", accessCode);
    } catch (e) { setBusy(false); setChecking(false); return toast.error((e as Error).message); }
    setChecking(false);
    const res = await fetch("/api/anonymous", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Could not send");
    setReference(d.reference);
    setTrackingKey(d.key);
  }

  if (reference && trackingKey) return <AnonymousSuccess reference={reference} trackingKey={trackingKey} />;

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -24 }),
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* progress */}
      <div className="mb-5 flex items-center gap-3">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
            <div className={cn("mt-1.5 text-xs", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.18 }} className="space-y-6">
            {step === 0 && (
              <>
                <fieldset>
                  <legend className="mb-3 text-lg font-semibold">What is it about?</legend>
                  <div role="radiogroup" aria-label="What is this about?" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {categories.map((c) => {
                      const Icon = categoryIcon(c.name);
                      const on = v.categoryId === c.id;
                      return (
                        <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setV({ ...v, categoryId: c.id })}
                          className={cn("group flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl border p-3 text-left text-sm font-medium transition",
                            on ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/50")}>
                          <Icon className={cn("size-5", on ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                          <span className="leading-tight">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                {category?.sensitive && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="size-4 shrink-0" /> Handled by HR only. In danger? Call emergency services.
                  </p>
                )}
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">How urgent?</legend>
                  <div role="radiogroup" aria-label="How urgent is it?" className="grid grid-cols-4 gap-2">
                    {priorities.map((p) => (
                      <button key={p.id} type="button" role="radio" aria-checked={v.priorityId === p.id} data-on={v.priorityId === p.id} onClick={() => setV({ ...v, priorityId: p.id })}
                        className={cn("rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors hover:bg-accent", URGENCY[p.key])}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {showDept || v.departmentId ? (
                  <div className="space-y-2">
                    <Label htmlFor="dep">Department <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <NativeSelect id="dep" value={v.departmentId} onChange={set("departmentId")}>
                      <option value="">Not specific</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </NativeSelect>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowDept(true)} className="text-sm font-medium text-primary hover:underline">+ Add department (optional)</button>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={v.title} onChange={set("title")} maxLength={150} placeholder="In a few words" className="h-10" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="desc">What happened?</Label>
                    {descLeft > 0 && <span className="text-xs text-muted-foreground">{descLeft} more</span>}
                  </div>
                  <Textarea id="desc" value={v.description} onChange={set("description")} rows={7} maxLength={10000} placeholder="Tip: leave out details only you would know." />
                </div>
                <div className="space-y-2">
                  <input ref={fileRef} id="files" type="file" multiple hidden accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, MAX_ATTACHMENTS)); e.target.value = ""; }} />
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">Attachment {i + 1}</span>
                      <span className="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
                      <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X className="size-3.5" /></Button>
                    </div>
                  ))}
                  {files.length < MAX_ATTACHMENTS && (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
                      <ImagePlus className="size-4" /> Add photo or PDF <span className="text-xs">(optional)</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="rounded-2xl bg-muted/50 p-4">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {category && <span className="rounded-full bg-background px-2.5 py-1 font-medium">{category.name}</span>}
                    <span className="rounded-full bg-background px-2.5 py-1">{priorities.find((p) => p.id === v.priorityId)?.name}</span>
                    {v.departmentId && <span className="rounded-full bg-background px-2.5 py-1">{departments.find((d) => d.id === v.departmentId)?.name}</span>}
                    {files.length > 0 && <span className="rounded-full bg-background px-2.5 py-1">{files.length} file{files.length > 1 ? "s" : ""}</span>}
                  </div>
                  <div className="mt-3 font-semibold">{v.title}</div>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{v.description}</p>
                </div>
                <p className="flex items-center gap-2 text-sm"><Lock className="size-4 shrink-0 text-primary" /> Nobody, including administrators, can see who sent this.</p>
                {requireCode && (
                  <div className="space-y-2">
                    <Label htmlFor="code">Company access code</Label>
                    <Input id="code" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" placeholder="From the notice board" className="h-10 font-mono uppercase" />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-7 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || busy} className={cn(step === 0 && "invisible")}><ArrowLeft /> Back</Button>
          {step < 2 ? (
            <div className="flex items-center gap-3">
              {!valid[step] && <span className="hidden text-xs text-muted-foreground sm:inline">{step === 0 ? "Pick a topic" : !v.title.trim() ? "Add a title" : `${descLeft} more characters`}</span>}
              <Button size="lg" onClick={() => go(step + 1)} disabled={!valid[step]}>Continue <ArrowRight /></Button>
            </div>
          ) : (
            <Button size="lg" onClick={submit} disabled={busy || !valid[2]}>{busy && <Loader2 className="animate-spin" />} {checking ? "Securing…" : "Send feedback"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AnonymousSuccess({ reference, trackingKey }: { reference: string; trackingKey: string }) {
  const reduce = useReducedMotion();
  const [saved, setSaved] = useState(false);
  const both = `Reference: ${reference}\nSecret key: ${trackingKey}`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([both + "\n\nTrack at: " + location.origin + "/track\n"], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `feedback-${reference}.txt` });
    a.click(); URL.revokeObjectURL(url); setSaved(true);
  };
  return (
    <motion.div initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-md">
      <div className="rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
          className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="size-8" strokeWidth={3} />
        </motion.div>
        <h2 className="mt-4 text-2xl font-bold">Sent anonymously</h2>
        <p className="mt-1 text-sm text-muted-foreground">Save these to follow up. <span className="font-semibold text-foreground">Shown once only.</span></p>
        <dl className="mt-6 space-y-2.5 text-left">
          <div className="rounded-2xl bg-muted/60 px-4 py-3"><dt className="text-xs text-muted-foreground">Reference</dt><dd className="font-mono text-lg font-semibold tracking-wider">{reference}</dd></div>
          <div className="rounded-2xl bg-primary/10 px-4 py-3"><dt className="text-xs text-muted-foreground">Secret key</dt><dd className="break-all font-mono text-lg font-semibold tracking-wider text-primary">{trackingKey}</dd></div>
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(both); setSaved(true); toast.success("Copied"); }}><Copy /> Copy</Button>
          <Button variant="outline" onClick={download}><Download /> Save file</Button>
        </div>
        {!saved && <button className="mt-3 text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => setSaved(true)}>I took a screenshot</button>}
        <Link href="/track" className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full", !saved && "pointer-events-none opacity-40")} aria-disabled={!saved}>
          {saved ? "Go to tracking" : "Save them first"}
        </Link>
      </div>
    </motion.div>
  );
}
