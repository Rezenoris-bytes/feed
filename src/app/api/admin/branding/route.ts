import { NextResponse } from "next/server";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";
import { removeLogo, saveLogo } from "@/server/branding";
import { HttpError, notFound } from "@/server/rbac";
import { rateLimit } from "@/server/rate-limit";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth("admin.settings");
  if (!rateLimit("branding:" + auth.userId, 20, 60 * 60_000)) throw new HttpError(429, "Too many uploads");
  const file = (await req.formData()).get("logo");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose an image");
  return NextResponse.json(await saveLogo(file, auth.userId));
});

export const DELETE = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth("admin.settings");
  if (!auth.roles.includes("SUPER_ADMIN")) throw notFound();
  await removeLogo(auth.userId);
  return NextResponse.json({ ok: true });
});
