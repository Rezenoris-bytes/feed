import { NextResponse } from "next/server";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { AdminAction, runAdminAction } from "@/server/admin";
import { HttpError } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth();
  if (!auth.roles.includes("SUPER_ADMIN")) throw new HttpError(404, "Not found");
  if (!rateLimit("admin:" + auth.userId, 120, 60 * 60_000)) throw new HttpError(429, "Too many requests");
  const result = await runAdminAction(auth, AdminAction.parse(await req.json()));
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
});
