import { FileText, MessageCircle, Pause } from "lucide-react";
import { StatusBadge, StatusProgress, categoryIcon, fmtDate, fmtSize } from "./bits";
import { MessageThread } from "./message-thread";
import { STATUS_HINT, isFinal, type Status } from "@/lib/feedback-meta";

type Case = {
  reference: string; title: string; description: string; status: string; submittedOn: Date;
  category: { name: string };
  attachments: { id: string; label: string; sizeBytes: number }[];
  history: { toStatus: string; createdAt: Date }[];
  messages: { id: string; author: string; body: string; createdAt: Date }[];
};

/** What the sender sees about their case: progress, the conversation, and what they sent. Never staff names or internal data. */
export function SubmitterCaseView({ fb, postUrl, payload, action }: { fb: Case; postUrl: string; payload?: Record<string, string>; action?: React.ReactNode }) {
  const Icon = categoryIcon(fb.category.name);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* header + progress */}
      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 break-words text-xl font-bold tracking-tight sm:text-2xl">{fb.title}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{fb.reference}</span> · {fmtDate(fb.submittedOn)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        </div>
        <StatusProgress status={fb.status} className="mt-6" />
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <StatusBadge status={fb.status} /> {STATUS_HINT[fb.status as Status]}
        </p>
        {fb.status === "ON_HOLD" && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <Pause className="size-4" /> Reply below to continue.
          </p>
        )}
      </section>

      {/* conversation */}
      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-primary" /> Messages</h2>
        <MessageThread postUrl={postUrl} payload={payload} closed={isFinal(fb.status)}
          placeholder="Write a reply…" emptyText="No replies yet."
          messages={fb.messages.map((m) => ({ id: m.id, mine: m.author === "EMPLOYEE", who: m.author === "EMPLOYEE" ? "You" : "Feedback team", body: m.body, createdAt: m.createdAt.toISOString() }))} />
      </section>

      {/* what was sent */}
      <details className="group rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <summary className="cursor-pointer list-none font-semibold">
          <span className="flex items-center justify-between">Your feedback <span className="text-xs font-normal text-muted-foreground group-open:hidden">Show</span></span>
        </summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{fb.description}</p>
        {fb.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {fb.attachments.map((a) => (
              <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-accent">
                <FileText className="size-4" /> {a.label} <span className="text-xs text-muted-foreground">{fmtSize(a.sizeBytes)}</span>
              </a>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
