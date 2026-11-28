"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, Link2, Loader2, Mail, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/feedback/bits";
import { whatsappUrl, type SendState } from "@/lib/customer-forms";
import { cn } from "@/lib/utils";
import { api } from "./form-builder";

export const STATE_STYLE: Record<SendState, { label: string; cls: string }> = {
  sent: { label: "Sent", cls: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300" },
  opened: { label: "Opened", cls: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300" },
  replied: { label: "Replied", cls: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" },
  expired: { label: "Expired", cls: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300" },
  withdrawn: { label: "Withdrawn", cls: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300" },
};
export function StateBadge({ state }: { state: SendState }) {
  const s = STATE_STYLE[state];
  return <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", s.cls)}>{s.label}</span>;
}

async function copy(text: string, what = "Link copied") {
  try { await navigator.clipboard.writeText(text); toast.success(what); } catch { toast.error("Couldn't copy. Select and copy it manually."); }
}

type Created = { link: string; message: string; emailed: boolean; emailFailed: boolean; phone?: string; email?: string; name: string };

/** Make a personal link for one customer, then share it by WhatsApp, email or copy. */
export function SendPanel({ formId, mailReady, live }: { formId: string; mailReady: boolean; live: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [byEmail, setByEmail] = useState(mailReady);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const sendEmail = byEmail && mailReady && !!f.email?.trim();
    setBusy(true);
    try {
      const r = await api(`/api/customer-forms/${formId}/sends`, "POST", { ...f, days: Number(f.days), sendEmail });
      setCreated({ ...r, phone: f.phone, email: f.email, name: f.customerName });
      if (r.emailed) toast.success(`Emailed to ${f.email}`);
      if (r.emailFailed) toast.error("The email couldn't be sent. Use WhatsApp or copy the link.");
      form.reset(); router.refresh();
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  }

  if (!live) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Publish the form first, then you can send it.</p>;

  if (created) {
    const full = `${created.message}\n${created.link}`;
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="flex items-center gap-2 font-semibold"><Check className="size-5 text-emerald-600" /> Link ready for {created.name}</p>
        <button type="button" onClick={() => copy(created.link)} className="mt-3 flex w-full items-center gap-2 rounded-md border bg-muted px-3 py-2.5 text-left font-mono text-xs">
          <Link2 className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{created.link}</span><Copy className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a href={whatsappUrl(created.phone, full)} target="_blank" rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg" }), "bg-[#25D366] text-white hover:bg-[#1fb757]")}><MessageCircle /> WhatsApp</a>
          {created.emailed
            ? <span className={cn(buttonVariants({ variant: "outline", size: "lg" }), "pointer-events-none text-emerald-600")}><Check /> Emailed</span>
            : <a href={`mailto:${created.email ?? ""}?subject=${encodeURIComponent("Your feedback")}&body=${encodeURIComponent(full)}`} className={buttonVariants({ variant: "outline", size: "lg" })}><Mail /> Email app</a>}
          <Button variant="outline" size="lg" onClick={() => copy(full, "Message copied")}><Copy /> Copy message</Button>
        </div>
        {!created.phone && <p className="mt-2 text-xs text-muted-foreground">No phone number: WhatsApp will ask you to pick the contact.</p>}
        <Button variant="ghost" className="mt-4 w-full" onClick={() => setCreated(null)}><Send /> Send to another customer</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="customerName">Customer name *</Label><Input id="customerName" name="customerName" required minLength={2} maxLength={120} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="company">Company</Label><Input id="company" name="company" maxLength={120} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">WhatsApp number</Label><Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+91 98765 43210" maxLength={32} autoComplete="off" />
          <p className="text-xs text-muted-foreground">With country code</p></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" maxLength={254} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="machine">Machine <span className="font-normal text-muted-foreground">(model or serial)</span></Label><Input id="machine" name="machine" maxLength={160} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="days">Link works for</Label>
          <NativeSelect id="days" name="days" defaultValue="30" className="[&_select]:h-9">
            {[7, 14, 30, 60, 90].map((n) => <option key={n} value={n}>{n} days</option>)}
          </NativeSelect></div>
      </div>
      <label className={cn("flex w-fit items-center gap-2 text-sm", !mailReady && "text-muted-foreground")}>
        <Checkbox checked={byEmail && mailReady} disabled={!mailReady} onCheckedChange={(v) => setByEmail(!!v)} />
        Also send by email automatically
      </label>
      {!mailReady && <p className="-mt-2 text-xs text-muted-foreground">Email sending isn't set up on the server. You can still use WhatsApp, your email app, or copy the link.</p>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Create link</Button>
    </form>
  );
}

/** Row actions on an existing send: copy, WhatsApp, email again, withdraw. */
export function SendRowActions({ id, state, hasEmail, mailReady }: { id: string; state: SendState; hasEmail: boolean; mailReady: boolean }) {
  const router = useRouter();
  const open = state === "sent" || state === "opened";
  const get = () => api(`/api/customer-sends/${id}`, "GET") as Promise<{ link: string; message: string; phone: string | null }>;
  async function run(fn: () => Promise<unknown>, ok?: string) {
    try { await fn(); if (ok) toast.success(ok); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Link actions" />}><MoreHorizontal /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={!open} onClick={() => run(async () => { const r = await get(); await copy(r.link); })}><Copy /> Copy link</DropdownMenuItem>
        <DropdownMenuItem disabled={!open} onClick={() => run(async () => {
          const w = window.open("", "_blank");
          const r = await get();
          if (w) { w.opener = null; w.location.href = whatsappUrl(r.phone, `${r.message}\n${r.link}`); }
        })}><MessageCircle /> WhatsApp again</DropdownMenuItem>
        <DropdownMenuItem disabled={!open || !hasEmail || !mailReady} onClick={() => run(() => api(`/api/customer-sends/${id}`, "POST", { action: "email" }), "Email sent")}><Mail /> Email again</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={!open} onClick={() => run(() => api(`/api/customer-sends/${id}`, "POST", { action: "revoke" }), "Link withdrawn")}><Ban /> Withdraw link</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
