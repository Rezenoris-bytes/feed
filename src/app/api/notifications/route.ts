import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/session";
import { assertSameOrigin, handler } from "@/server/http";

export const GET = handler(async () => {
  const auth = await requireAuth();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, text: true, link: true, readAt: true, createdAt: true } }),
    prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread }, { headers: { "Cache-Control": "no-store" } });
});

/** POST: mark all as read. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth();
  await prisma.notification.updateMany({ where: { userId: auth.userId, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
});
