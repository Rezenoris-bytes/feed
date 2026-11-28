import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { HttpError } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";
import { emailSendAgain, revokeSend, sendLink } from "@/server/customer-forms";

type Ctx = { params: Promise<{ id: string }> };

/** The link + message again, for Copy / WhatsApp on an existing send. */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  await requireAuth("customers.manage");
  return NextResponse.json(await sendLink((await ctx.params).id, req), { headers: { "Cache-Control": "no-store" } });
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const auth = await requireAuth("customers.manage");
  if (!rateLimit("csend:" + auth.userId, 300, 60 * 60_000)) throw new HttpError(429, "Too many requests");
  const { action } = z.object({ action: z.enum(["email", "revoke"]) }).parse(await req.json());
  const id = (await ctx.params).id;
  if (action === "email") await emailSendAgain(auth, id, req);
  else await revokeSend(auth, id);
  return NextResponse.json({ ok: true });
});
