import { z } from "zod";
import { getAuth, requireAuth } from "@/server/session";
import { handler } from "@/server/http";
import { canReadAttachment } from "@/server/feedback";
import { readAttachment } from "@/server/files";
import { trackedFeedbackId } from "@/server/anonymous";
import { prisma } from "@/server/db";
import { notFound } from "@/server/rbac";

async function resolve(id: string) {
  // Anonymous sender with an unlocked tracking session for this case.
  const tracked = await trackedFeedbackId();
  if (tracked && !(await getAuth())) {
    if (!z.string().uuid().safeParse(id).success) throw notFound();
    const a = await prisma.feedbackAttachment.findFirst({ where: { id, feedbackId: tracked } });
    if (!a) throw notFound();
    return a;
  }
  return canReadAttachment(await requireAuth(), id);
}

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await resolve(id);
  const data = await readAttachment(a.storageKey);
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[a.mimeType] ?? "bin";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Disposition": `inline; filename="attachment.${ext}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
