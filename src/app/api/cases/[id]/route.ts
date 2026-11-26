import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { assignCase, changeStatus, staffMessage } from "@/server/feedback";
import { STATUSES } from "@/lib/feedback-meta";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), to: z.enum(STATUSES) }),
  z.object({ action: z.literal("assign"), assigneeId: z.string().uuid() }),
  z.object({ action: z.literal("message"), body: z.string().trim().min(1).max(5000) }),
]);

/** All staff case actions. Each service function re-checks role and row scope. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireAuth();
  const { id } = await ctx.params;
  const a = Action.parse(await req.json());
  if (a.action === "status") await changeStatus(auth, id, a.to);
  if (a.action === "assign") await assignCase(auth, id, a.assigneeId);
  if (a.action === "message") await staffMessage(auth, id, a.body);
  return NextResponse.json({ ok: true });
});
