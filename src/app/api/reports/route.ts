import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/session";
import { handler } from "@/server/http";
import { rangeFor } from "@/server/stats";
import { toCsv, toPdf } from "@/server/reports";

const Q = z.object({ format: z.enum(["csv", "pdf"]), period: z.enum(["day", "week", "month", "quarter", "year"]).default("month") });

export const GET = handler(async (req: Request) => {
  const auth = await requireAuth("reports.export");
  const q = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const range = rangeFor(q.period);
  await prisma.auditLog.create({ data: { actorId: auth.userId, action: "report.export", meta: { format: q.format, period: q.period } } });
  const name = `feedback-report-${q.period}-${new Date().toISOString().slice(0, 10)}.${q.format}`;
  const body = q.format === "csv" ? await toCsv(auth, range) : new Uint8Array(await toPdf(auth, range, range.label));
  return new Response(body, {
    headers: {
      "Content-Type": q.format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
