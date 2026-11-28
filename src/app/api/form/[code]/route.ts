import { NextResponse } from "next/server";
import { assertSameOrigin, handler } from "@/server/http";
import { HttpError } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";
import { submitShare } from "@/server/customer-forms";

/** Someone answers a form through its open link. No login; limited per device and per form so it can't be flooded. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  assertSameOrigin(req);
  const { code } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit("share-ip:" + ip, 30, 60 * 60_000) || !rateLimit("share-form:" + code, 300, 60 * 60_000))
    throw new HttpError(429, "Too many replies from here. Please try again later.");
  const r = await submitShare(code, await req.json());
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
});
