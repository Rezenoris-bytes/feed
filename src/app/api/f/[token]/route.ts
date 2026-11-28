import { NextResponse } from "next/server";
import { assertSameOrigin, handler } from "@/server/http";
import { HttpError } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";
import { submitAnswers } from "@/server/customer-forms";

/** Customer submits their answers. No login: the secret link is the key, and it works once. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ token: string }> }) => {
  assertSameOrigin(req);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit("cform-ip:" + ip, 30, 60 * 60_000)) throw new HttpError(429, "Too many attempts. Please try again later.");
  const r = await submitAnswers((await ctx.params).token, await req.json());
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
});
