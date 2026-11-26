import { EyeOff, FileText, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/server/rbac";
import type { AuthContext } from "@/server/session";
import type { getStaff, assignableStaff } from "@/server/feedback";
import { REVIEWER_TARGETS, STATUS_LABEL, TRANSITIONS, type Status } from "@/lib/feedback-meta";
import { StatusBadge, fmtDate, fmtDateTime, fmtSize } from "./bits";
import { MessageThread } from "./message-thread";
import { AssignAction, StatusAction } from "./case-actions";

type Case = Awaited<ReturnType<typeof getStaff>>;

export function CaseDetail({ fb, auth, staff }: { fb: Case; auth: AuthContext; staff: Awaited<ReturnType<typeof assignableStaff>> }) {
  const status = fb.status as Status;
  const isHr = can(auth.roles, "feedback.read.all");
  const isSuper = auth.roles.includes("SUPER_ADMIN");
  const targets = isHr ? TRANSITIONS[status] : TRANSITIONS[status].filter((s) => REVIEWER_TARGETS.includes(s));
  const active = fb.assignments.find((a) => a.active);
  const closed = ["CLOSED", "REJECTED", "DUPLICATE"].includes(status);
  const who = (id: string | null) => (id ? fb.names[id] ?? "Staff" : "Submitter");

  return (
    <>
      <PageHeader title={fb.title} description={`${fb.reference} · submitted ${fmtDate(fb.submittedOn)}`}>
        <StatusBadge status={status} className="text-sm" />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Feedback {fb.category.sensitive && <Lock className="size-4 text-rose-700 dark:text-rose-300" />}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap break-words text-sm">{fb.description}</p>
              {fb.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fb.attachments.map((a) => (
                    <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                      <FileText className="size-4" /> {a.label} <span className="text-xs text-muted-foreground">{fmtSize(a.sizeBytes)}</span>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Conversation with submitter</CardTitle></CardHeader>
            <CardContent>
              <MessageThread postUrl={`/api/cases/${fb.id}`} payload={{ action: "message" }} closed={closed}
                placeholder="Reply to the submitter. They will see this as 'Feedback team'." emptyText="No messages yet."
                messages={fb.messages.map((m) => ({
                  id: m.id, mine: m.author === "STAFF", who: m.author === "STAFF" ? who(m.staffId) : "Submitter",
                  body: m.body, createdAt: m.createdAt.toISOString(), dateOnly: m.author === "EMPLOYEE",
                }))} />
            </CardContent>
          </Card>

       </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Type</dt><dd>{fb.anonymous ? "Anonymous (no login)" : "Confidential"}</dd>
                <dt className="text-muted-foreground">Category</dt><dd>{fb.category.name}</dd>
                <dt className="text-muted-foreground">Priority</dt><dd>{fb.priority.name}</dd>
                <dt className="text-muted-foreground">Department</dt><dd>{fb.department?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Assigned</dt><dd>{active?.assignee.displayName ?? "Unassigned"}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <StatusAction id={fb.id} current={status} targets={targets} canOverride={isSuper} />
              {can(auth.roles, "feedback.assign") && !closed && (
                <div className="space-y-2 border-t pt-4"><div className="text-sm font-medium">Assignment</div><AssignAction id={fb.id} staff={staff} currentId={active?.assignee.id} /></div>
              )}
              {fb.anonymous && (
                <div className="flex gap-2 border-t pt-4 text-xs text-muted-foreground">
                  <EyeOff className="mt-0.5 size-3.5 shrink-0" /> Submitted anonymously. No identity is recorded, so nobody can find out who sent it.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {fb.history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-card" />
                    <div className="text-sm font-medium">{STATUS_LABEL[h.toStatus as Status]}</div>
                    <div className="text-xs text-muted-foreground">{who(h.actorId)} · {h.actorId ? fmtDateTime(h.createdAt) : fmtDate(h.createdAt)}</div>
                    {h.remarks && <p className="mt-1 text-xs text-muted-foreground">{h.remarks}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
