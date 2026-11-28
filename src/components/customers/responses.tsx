import { Star } from "lucide-react";
import { EmptyState, fmtDate } from "@/components/feedback/bits";
import { SEND_STATE, type CustomerField } from "@/lib/customer-forms";
import type { FormDetail } from "@/server/customer-forms";
import { StateBadge } from "./send-panel";
import { FIELD_ICON } from "./icons";

type Ans = string | number | string[];

function Stars({ n, className = "size-4" }: { n: number; className?: string }) {
  return <span className="inline-flex gap-0.5" aria-label={`${n} of 5`}>{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`${className} ${s <= Math.round(n) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />)}</span>;
}

/** Per-question summary across all replies: average stars, yes/no split, option counts. */
function Summary({ fields, replies }: { fields: CustomerField[]; replies: Record<string, Ans>[] }) {
  const rows = fields.filter((f) => f.type !== "short" && f.type !== "long");
  if (!rows.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((f) => {
        const vals = replies.map((r) => r[f.id]).filter((v) => v !== undefined);
        const Icon = FIELD_ICON[f.type];
        let body: React.ReactNode = <p className="text-sm text-muted-foreground">No answers yet</p>;
        if (vals.length && f.type === "rating") {
          const avg = vals.reduce<number>((a, v) => a + Number(v), 0) / vals.length;
          body = <div className="flex items-center gap-3"><span className="text-3xl font-bold tabular-nums">{avg.toFixed(1)}</span><Stars n={avg} className="size-5" /><span className="text-xs text-muted-foreground">{vals.length} {vals.length === 1 ? "answer" : "answers"}</span></div>;
        } else if (vals.length) {
          const opts = f.type === "yesno" ? ["Yes", "No"] : f.options;
          const count = (o: string) => vals.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length;
          body = (
            <ul className="space-y-1.5">
              {opts.map((o) => { const c = count(o); const pct = Math.round((c / vals.length) * 100); return (
                <li key={o} className="text-sm">
                  <div className="flex justify-between gap-2"><span className="truncate">{o}</span><span className="tabular-nums text-muted-foreground">{c} · {pct}%</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                </li>
              ); })}
            </ul>
          );
        }
        return (
          <section key={f.id} className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-start gap-2 text-sm font-medium"><Icon className="mt-0.5 size-4 shrink-0 text-primary" />{f.label}</h3>
            {body}
          </section>
        );
      })}
    </div>
  );
}

function AnswerValue({ f, v }: { f: CustomerField; v: Ans | undefined }) {
  if (v === undefined) return <span className="text-muted-foreground">—</span>;
  if (f.type === "rating") return <Stars n={Number(v)} />;
  if (Array.isArray(v)) return <>{v.join(", ")}</>;
  return <span className="whitespace-pre-wrap break-words">{String(v)}</span>;
}

export function ResponsesView({ form }: { form: FormDetail }) {
  const replied = form.sends.filter((s) => s.response);
  if (!replied.length) return <EmptyState title="No replies yet" text="Replies appear here as soon as a customer sends the form." />;
  return (
    <div className="space-y-6">
      <Summary fields={form.fields} replies={replied.map((s) => s.response!.answers)} />
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Replies · {replied.length}</h2>
        {replied.map((s) => (
          <details key={s.id} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.customerName}{s.company && <span className="font-normal text-muted-foreground"> · {s.company}</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{s.machine ? `${s.machine} · ` : ""}{fmtDate(s.response!.submittedAt)}</p>
              </div>
              <StateBadge state={SEND_STATE(s)} />
            </summary>
            <dl className="space-y-3 border-t px-4 py-4 text-sm">
              {s.response!.fields.map((f) => (
                <div key={f.id}><dt className="text-xs text-muted-foreground">{f.label}</dt><dd className="mt-0.5"><AnswerValue f={f} v={s.response!.answers[f.id]} /></dd></div>
              ))}
              {(s.email || s.phone) && <p className="border-t pt-3 text-xs text-muted-foreground">{[s.phone, s.email].filter(Boolean).join(" · ")}</p>}
            </dl>
          </details>
        ))}
      </div>
    </div>
  );
}
