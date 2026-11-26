"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "./bits";

export type ThreadMessage = { id: string; mine: boolean; who: string; body: string; createdAt: string; dateOnly?: boolean };

export function MessageThread({ messages, postUrl, payload, placeholder, closed, emptyText }: {
  messages: ThreadMessage[]; postUrl: string; payload?: Record<string, string>; placeholder: string; closed?: boolean; emptyText: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const res = await fetch(postUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, body }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Could not send");
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg border px-3.5 py-2.5", m.mine ? "border-primary/25 bg-primary/10" : "bg-muted/40")}>
                <div className="mb-1 text-xs text-muted-foreground">{m.who} · {m.dateOnly ? fmtDate(m.createdAt) : fmtDateTime(m.createdAt)}</div>
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {!closed && (
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} rows={3} maxLength={5000} />
          <div className="flex justify-end">
            <Button onClick={send} disabled={busy || !body.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send</Button>
          </div>
        </div>
      )}
    </div>
  );
}
