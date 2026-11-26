import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, fmtDate, fmtSize } from "./bits";
import { MessageThread } from "./message-thread";
import { STATUS_LABEL, type Status } from "@/lib/feedback-meta";

type Case = {
  reference: string; title: string; description: string; status: string; submittedOn: Date;
  category: { name: string };
  attachments: { id: string; label: string; sizeBytes: number }[];
  history: { toStatus: string; createdAt: Date }[];
  messages: { id: string; author: string; body: string; createdAt: Date }[];
};

/** What the submitter sees about their own case: status, conversation, attachments. Never staff names or notes. */
export function SubmitterCaseView({ fb, postUrl, payload, action }: { fb: Case; postUrl: string; payload?: Record<string, string>; action?: React.ReactNode }) {
  const closed = ["CLOSED", "REJECTED", "DUPLICATE"].includes(fb.status);
  return (
    <>
      <PageHeader title={fb.title} description={`${fb.reference} · ${fb.category.name} · submitted ${fmtDate(fb.submittedOn)}`}>
        <div className="flex items-center gap-2"><StatusBadge status={fb.status} className="text-sm" />{action}</div>
      </PageHeader>
      {fb.status === "AWAITING_INFO" && (
        <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm">The team needs more information. Reply in the conversation below.</div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>What you reported</CardTitle></CardHeader>
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
            <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
            <CardContent>
              <MessageThread postUrl={postUrl} payload={payload} closed={closed}
                placeholder="Add information or reply to the team…" emptyText="No messages yet. The team will reply here."
                messages={fb.messages.map((m) => ({ id: m.id, mine: m.author === "EMPLOYEE", who: m.author === "EMPLOYEE" ? "You" : "Feedback team", body: m.body, createdAt: m.createdAt.toISOString() }))} />
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-5">
              {fb.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <div className="text-sm font-medium">{STATUS_LABEL[h.toStatus as Status]}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(h.createdAt)}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
