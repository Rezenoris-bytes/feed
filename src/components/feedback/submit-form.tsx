"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Copy, FileText, Loader2, Paperclip, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_ATTACHMENTS } from "@/lib/feedback-meta";
import { NativeSelect, fmtSize } from "./bits";
import { solveChallenge } from "@/lib/pow-client";

type Opt = { id: string; name: string };
type Props = {
  categories: (Opt & { sensitive: boolean })[]; priorities: (Opt & { key: string })[]; departments: Opt[];
  /** Every submission is anonymous: no login, no identity recorded; tracked with a one-time secret key. */
  requireCode?: boolean;
};
const STEPS = ["About", "Details", "Review"];

export function SubmitForm({ categories, priorities, departments, requireCode = false }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [trackingKey, setTrackingKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState({
    categoryId: "", priorityId: priorities.find((p) => p.key === "MEDIUM")?.id ?? "", departmentId: "", title: "", description: "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const category = categories.find((c) => c.id === v.categoryId);
  const descLeft = Math.max(0, 20 - v.description.trim().length);

  const valid = [
    !!v.categoryId && !!v.priorityId,
    v.title.trim().length >= 1 && descLeft === 0,
    !requireCode || accessCode.trim().length > 0,
  ];
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  async function submit() {
    setBusy(true);
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.append(k, val));
    files.forEach((f) => fd.append("files", f));
    {
      try {
        setChecking(true);
        const pow = await solveChallenge();
        fd.append("challenge", pow.challenge); fd.append("counter", pow.counter); fd.append("accessCode", accessCode);
      } catch (e) { setBusy(false); setChecking(false); return toast.error((e as Error).message); }
      setChecking(false);
    }
    const res = await fetch("/api/anonymous", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Could not submit");
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
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors", i <= step ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{i + 1}</span>
            <span className={cn("hidden text-sm sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />}
          </li>
        ))}
      </ol>

      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.18 }} className="space-y-5">
              {step === 0 && (
                <>
                  <Field label="What is this about?" htmlFor="cat">
                    <NativeSelect id="cat" value={v.categoryId} onChange={set("categoryId")}>
                      <option value="" disabled>Choose a category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </NativeSelect>
                  </Field>
                  {category?.sensitive && (
                    <div className="flex gap-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                      <p>This will be treated as high priority and handled by HR only. If you are in immediate danger, contact emergency services.</p>
                    </div>
                  )}
                  <Field label="How urgent is it?" htmlFor="pri">
                    <div id="pri" role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {priorities.map((p) => (
                        <button key={p.id} type="button" role="radio" aria-checked={v.priorityId === p.id} onClick={() => setV({ ...v, priorityId: p.id })}
                          className={cn("rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent", v.priorityId === p.id && "border-primary bg-primary/10 text-primary")}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Department it concerns" hint="Optional. Helps route it to the right reviewer." htmlFor="dep">
                    <NativeSelect id="dep" value={v.departmentId} onChange={set("departmentId")}>
                      <option value="">Not specific / prefer not to say</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </NativeSelect>
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Title" htmlFor="title" hint={`${v.title.length}/150`}>
                    <Input id="title" value={v.title} onChange={set("title")} maxLength={150} placeholder="A short summary" />
                  </Field>
                  <Field label="Describe what happened" htmlFor="desc" hint={descLeft > 0 ? `${descLeft} more character${descLeft === 1 ? "" : "s"} needed (minimum 20). Avoid details only you would know if you want to stay unidentifiable.` : "Avoid details only you would know if you want to stay unidentifiable."}>
                    <Textarea id="desc" value={v.description} onChange={set("description")} rows={8} maxLength={10000} />
                  </Field>
                  <Field label="Supporting files" hint={`Optional. Up to ${MAX_ATTACHMENTS} JPG, PNG, WEBP or PDF files.`} htmlFor="files">
                    <input ref={fileRef} id="files" type="file" multiple hidden accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, MAX_ATTACHMENTS)); e.target.value = ""; }} />
                    <div className="space-y-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <FileText className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">Attachment {i + 1}</span>
                          <span className="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
                          <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X className="size-3.5" /></Button>
                        </div>
                      ))}
                      {files.length < MAX_ATTACHMENTS && <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip /> Add file</Button>}
                    </div>
                    <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3.5 shrink-0" /> File names, photo location and author details are removed. Screenshots can still show your name, so crop them first.
                    </p>
                  </Field>
                </>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <Summary k="Category" v={category?.name} />
                    <Summary k="Priority" v={priorities.find((p) => p.id === v.priorityId)?.name} />
                    <Summary k="Department" v={departments.find((d) => d.id === v.departmentId)?.name ?? "Not specified"} />
                  </dl>
                  <div><div className="font-medium">{v.title}</div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{v.description}</p></div>
                  {files.length > 0 && <p className="text-sm text-muted-foreground">{files.length} attachment(s)</p>}
                  <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p><span className="font-medium">Fully anonymous.</span> No account, name or device details are recorded. Nobody, including administrators, can find out who sent this. You&apos;ll get a secret key to follow up. If you lose it, you can&apos;t reopen this case.</p>
                  </div>
                  {requireCode && (
                    <Field label="Company access code" htmlFor="code" hint="Printed on the staff notice board. It's the same for everyone.">
                      <Input id="code" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} autoComplete="off" className="font-mono uppercase" />
                    </Field>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex justify-between gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || busy}><ArrowLeft /> Back</Button>
            {step < 2
              ? (
                <div className="flex items-center gap-3">
                  {!valid[step] && <span className="hidden text-xs text-muted-foreground sm:inline">{step === 0 ? "Choose a category" : !v.title.trim() ? "Add a title" : `Description needs ${descLeft} more character${descLeft === 1 ? "" : "s"}`}</span>}
                  <Button onClick={() => go(step + 1)} disabled={!valid[step]}>Continue <ArrowRight /></Button>
                </div>
              )
              : <Button onClick={submit} disabled={busy || !valid[2]}>{busy && <Loader2 className="animate-spin" />} {checking ? "Running security check…" : "Submit feedback"}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3"><Label htmlFor={htmlFor}>{label}</Label></div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Summary({ k, v }: { k: string; v?: string }) {
  return <div className="rounded-md border px-3 py-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>;
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
    <motion.div initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg">
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}>
            <CheckCircle2 className="size-14 text-primary" />
          </motion.div>
          <h2 className="mt-4 text-xl font-semibold">Sent anonymously</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Save both of these now. They are shown <span className="font-medium text-foreground">only once</span> and can&apos;t be recovered.</p>
          <dl className="mt-5 w-full space-y-3 text-left">
            <div><dt className="mb-1 text-xs text-muted-foreground">Reference</dt><dd className="rounded-md border bg-muted px-3 py-2 font-mono tracking-wider">{reference}</dd></div>
            <div><dt className="mb-1 text-xs text-muted-foreground">Secret key</dt><dd className="break-all rounded-md border border-primary/30 bg-primary/5 px-3 py-2 font-mono tracking-wider">{trackingKey}</dd></div>
          </dl>
          <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(both); setSaved(true); toast.success("Copied"); }}><Copy /> Copy both</Button>
            <Button variant="outline" className="flex-1" onClick={download}><FileText /> Save as file</Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Or take a screenshot{!saved && <> and <button className="text-primary underline-offset-4 hover:underline" onClick={() => setSaved(true)}>confirm you have</button></>}. Anyone with both can read the replies, so keep them private.
          </p>
          <Link href="/track" className={cn(buttonVariants(), "mt-6", !saved && "pointer-events-none opacity-50")} aria-disabled={!saved}>
            {saved ? "I've saved them. Go to tracking" : "Save them first"}
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
