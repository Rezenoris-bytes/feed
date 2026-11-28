import { NextResponse } from "next/server";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { HttpError } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";
import { createSend } from "@/server/customer-forms";

/** Creates a personal link for one customer (and emails it when asked). */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireAuth("customers.manage");
  if (!rateLimit("csend:" + auth.userId, 300, 60 * 60_000)) throw new HttpError(429, "Too many requests");
  const r = await createSend(auth, (await ctx.params).id, await req.json(), req);
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
});
