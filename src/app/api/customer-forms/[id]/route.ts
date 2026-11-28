import { NextResponse } from "next/server";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { deleteForm, updateForm } from "@/server/customer-forms";

type Ctx = { params: Promise<{ id: string }> };

/** Save questions ({title, intro, thanks, fields}) and/or change status ({status}). */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const auth = await requireAuth("customers.manage");
  await updateForm(auth, (await ctx.params).id, await req.json());
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const auth = await requireAuth("customers.manage");
  await deleteForm(auth, (await ctx.params).id);
  return NextResponse.json({ ok: true });
});
