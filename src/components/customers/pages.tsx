import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, ClipboardList, MessageSquareText, Send } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { EmptyState, fmtDate } from "@/components/feedback/bits";
import { cn } from "@/lib/utils";
import { SEND_STATE, whoLabel } from "@/lib/customer-forms";
import { baseUrlFrom, getFormDetail, listForms } from "@/server/customer-forms";
import { mailConfigured } from "@/server/mail";
import { FormBuilder } from "./form-builder";
import { FormStatusActions, NewFormButton } from "./form-actions";
import { SendPanel, SendRowActions, SharePanel, StateBadge } from "./send-panel";
import { ResponsesView } from "./responses";

const FORM_STATUS = {
  DRAFT: { label: "Draft", cls: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300" },
  ACTIVE: { label: "Live", cls: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" },
  ARCHIVED: { label: "Archived", cls: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300" },
};
function FormBadge({ status }: { status: keyof typeof FORM_STATUS }) {
  const s = FORM_STATUS[status];
  return <span className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", s.cls)}>{s.label}</span>;
}

/** /hr/customers and /admin/customers */
export async function CustomersHome({ base }: { base: string }) {
  const { forms, archived } = await listForms();
  return (
    <>
      <PageHeader title="Customer forms" description="Ask customers about machines and service"><NewFormButton base={base} /></PageHeader>
      {forms.length === 0 ? (
        <EmptyState title="No forms yet" text="Create one from a template: machine feedback or service cancellation." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <Link key={f.id} href={`${base}/${f.id}`} className="group rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><ClipboardList className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">Updated {fmtDate(f.updatedAt)}</p>
                </div>
                <FormBadge status={f.status} />
              </div>
              <div className="mt-4 flex gap-5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Send className="size-4" /><b className="font-semibold text-foreground tabular-nums">{f.sent}</b> sent</span>
                <span className="flex items-center gap-1.5 text-muted-foreground"><MessageSquareText className="size-4" /><b className="font-semibold text-foreground tabular-nums">{f.replied}</b> replied</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {archived > 0 && <p className="mt-6 text-center text-xs text-muted-foreground"><Link href={`${base}?archived=1`} className="underline underline-offset-2">{archived} archived</Link></p>}
    </>
  );
}

export async function ArchivedForms({ base }: { base: string }) {
  const { prisma } = await import("@/server/db");
  const rows = await prisma.customerForm.findMany({ where: { status: "ARCHIVED" }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHeader title="Archived forms" />
      <Link href={base} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Customer forms</Link>
      <div className="space-y-2">
        {rows.map((f) => <Link key={f.id} href={`${base}/${f.id}`} className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-accent"><span className="truncate font-medium">{f.title}</span><FormBadge status={f.status} /></Link>)}
      </div>
    </>
  );
}

const TABS = [
  { key: "send", label: "Send", icon: Send },
  { key: "responses", label: "Replies", icon: MessageSquareText },
  { key: "questions", label: "Questions", icon: ClipboardList },
] as const;

/** /hr/customers/[id] and /admin/customers/[id] */
export async function CustomerFormPage({ base, id, tab }: { base: string; id: string; tab?: string }) {
  const form = await getFormDetail(id).catch(() => null);
  if (!form) notFound();
  const active = TABS.find((t) => t.key === tab)?.key ?? (form.status === "DRAFT" ? "questions" : "send");
  const replied = form.sends.filter((s) => s.respondedAt).length;
  const mailReady = mailConfigured();
  const shareUrl = form.shareCode ? `${baseUrlFrom(await headers())}/form/${form.shareCode}` : null;

  return (
    <>
      <Link href={base} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Customer forms</Link>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight"><span className="break-words">{form.title}</span><FormBadge status={form.status} /></h1>
          <p className="mt-1 text-sm text-muted-foreground">{form.fields.length} questions · {form.sends.length} sent · {replied} replied</p>
        </div>
        <FormStatusActions id={form.id} status={form.status} sent={form.sends.length} base={base} />
      </div>

      <nav aria-label="Form sections" className="mb-5 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link key={t.key} href={`${base}/${form.id}?tab=${t.key}`} aria-current={active === t.key ? "page" : undefined}
            className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              active === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="size-4" />{t.label}
            {t.key === "responses" && replied > 0 && <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{replied}</span>}
          </Link>
        ))}
      </nav>

      {active === "questions" && <FormBuilder id={form.id} sent={form.sends.length} initial={{ title: form.title, intro: form.intro, thanks: form.thanks, fields: form.fields }} />}
      {active === "responses" && <ResponsesView form={form} />}
      {active === "send" && (
        <div className="space-y-6">
          {form.status === "ACTIVE" && <SharePanel formId={form.id} url={shareUrl} title={form.title} />}
          <div>
            {form.status === "ACTIVE" && <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Or send a personal link to one customer</h2>}
            <SendPanel formId={form.id} mailReady={mailReady} live={form.status === "ACTIVE"} />
          </div>
          {form.sends.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Links and replies · {form.sends.length}</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {form.sends.map((s) => {
                  const state = SEND_STATE(s);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{whoLabel(s)}{s.customerName && s.company && <span className="font-normal text-muted-foreground"> · {s.company}</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {fmtDate(s.createdAt)}{s.viaShare ? " · open link" : ""}{s.machine ? ` · ${s.machine}` : ""}{s.emailedAt ? " · emailed" : ""}{s.sentBy ? ` · by ${s.sentBy}` : ""}
                        </p>
                      </div>
                      <StateBadge state={state} />
                      {s.viaShare ? <span className="size-7" aria-hidden /> : <SendRowActions id={s.id} state={state} hasEmail={!!s.email} mailReady={mailReady} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
