import Link from "next/link";
import { ArrowLeft, FileText, Lock, MessageCircle } from "lucide-react";
import { can } from "@/server/rbac";
import type { AuthContext } from "@/server/session";
import type { getStaff, assignableStaff } from "@/server/feedback";
import { REVIEWER_TARGETS, STATUS_LABEL, TRANSITIONS, isFinal, type Status } from "@/lib/feedback-meta";
import { StatusBadge, StatusProgress, TONE_DOT, categoryIcon, fmtDate, fmtDateTime, fmtSize, toneOf } from "./bits";
import { MessageThread } from "./message-thread";
import { AssignAction, StatusAction } from "./case-actions";
import { cn } from "@/lib/utils";

type Case = Awaited<ReturnType<typeof getStaff>>;

export function CaseDetail({ fb, auth, staff, backHref }: { fb: Case; auth: AuthContext; staff: Awaited<ReturnType<typeof assignableStaff>>; backHref: string }) {
  const status = fb.status as Status;
  const isHr = can(auth.roles, "feedback.read.all");
  const isSuper = auth.roles.includes("SUPER_ADMIN");
  const targets = isHr ? TRANSITIONS[status] : TRANSITIONS[status].filter((s) => REVIEWER_TARGETS.includes(s));
  const active = fb.assignments.find((a) => a.active);
  const who = (id: string | null) => (id ? fb.names[id] ?? "Staff" : "Sender");
  const Icon = categoryIcon(fb.category.name);

  return (
    <div className="space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>

      {/* header */}
      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              {fb.category.sensitive && <Lock className="size-4 shrink-0 text-rose-600 dark:text-rose-300" aria-label="Sensitive" />}
              <span className="break-words">{fb.title}</span>
            </h1>
            <StatusBadge status={status} className="mt-1.5" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
          <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 font-mono">{fb.reference}</span>
          <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1">{fb.category.name}</span>
          <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1">{fb.priority.name}</span>
          {fb.department && <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1">{fb.department.name}</span>}
          <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1">{fmtDate(fb.submittedOn)}</span>
        </div>
        <StatusProgress status={status} className="mt-6" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            <p className="whitespace-pre-wrap break-words leading-relaxed">{fb.description}</p>
            {fb.attachments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {fb.attachments.map((a) => (
                  <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-accent">
                    <FileText className="size-4" /> {a.label} <span className="text-xs text-muted-foreground">{fmtSize(a.sizeBytes)}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-primary" /> Messages</h2>
            <MessageThread postUrl={`/api/cases/${fb.id}`} payload={{ action: "message" }} closed={isFinal(status)}
              placeholder="Reply to the sender (shown as “Feedback team”)" emptyText="No messages yet."
              messages={fb.messages.map((m) => ({
                id: m.id, mine: m.author === "STAFF", who: m.author === "STAFF" ? who(m.staffId) : "Sender",
                body: m.body, createdAt: m.createdAt.toISOString(), dateOnly: m.author === "EMPLOYEE",
              }))} />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Status</h2>
            <StatusAction id={fb.id} current={status} targets={targets} canOverride={isSuper} />
          </section>

          {can(auth.roles, "feedback.assign") && !isFinal(status) && (
            <section className="rounded-3xl border bg-card p-5 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold">Assigned to</h2>
              <p className="mb-3 text-sm text-muted-foreground">{active?.assignee.displayName ?? "Nobody yet"}</p>
              <AssignAction id={fb.id} staff={staff} currentId={active?.assignee.id} />
            </section>
          )}

          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">History</h2>
            <ol className="space-y-3">
              {fb.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[toneOf(h.toStatus)])} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{STATUS_LABEL[h.toStatus as Status] ?? h.toStatus}</div>
                    <div className="text-xs text-muted-foreground">{who(h.actorId)} · {h.actorId ? fmtDateTime(h.createdAt) : fmtDate(h.createdAt)}</div>
                    {h.remarks && <div className="text-xs text-muted-foreground">{h.remarks}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
