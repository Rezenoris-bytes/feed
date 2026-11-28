import { NextResponse } from "next/server";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { HttpError } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";
import { createForm } from "@/server/customer-forms";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth("customers.manage");
  if (!rateLimit("cforms:" + auth.userId, 60, 60 * 60_000)) throw new HttpError(429, "Too many requests");
  const f = await createForm(auth, await req.json());
  return NextResponse.json({ id: f.id });
});
