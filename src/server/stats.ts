import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { staffScope } from "./feedback";
import type { AuthContext } from "./session";
import { STATUS_LABEL, type Status } from "@/lib/feedback-meta";

export type Range = { from: Date; to: Date };

export function rangeFor(period: string | undefined): Range & { label: string } {
  const to = new Date();
  const from = new Date(to);
  switch (period) {
    case "day": from.setUTCHours(0, 0, 0, 0); return { from, to, label: "Today" };
    case "week": from.setUTCDate(from.getUTCDate() - 7); return { from, to, label: "Last 7 days" };
    case "month": from.setUTCMonth(from.getUTCMonth() - 1); return { from, to, label: "Last 30 days" };
    case "quarter": from.setUTCMonth(from.getUTCMonth() - 3); return { from, to, label: "Last 3 months" };
    default: from.setUTCFullYear(from.getUTCFullYear() - 1); return { from, to, label: "Last 12 months" };
  }
}

/** Aggregates only — never row-level data, never identity. Respects the caller's row scope. */
export async function getStats(auth: AuthContext, range: Range) {
  const where: Prisma.FeedbackSubmissionWhereInput = { AND: [staffScope(auth), { submittedOn: { gte: range.from, lte: range.to } }] };

  const [total, byStatus, byCategory, byPriority, byDept, resolved, monthly, categories, priorities, departments] = await Promise.all([
    prisma.feedbackSubmission.count({ where }),
    prisma.feedbackSubmission.groupBy({ by: ["status"], where, _count: true }),
    prisma.feedbackSubmission.groupBy({ by: ["categoryId"], where, _count: true }),
    prisma.feedbackSubmission.groupBy({ by: ["priorityId"], where, _count: true }),
    prisma.feedbackSubmission.groupBy({ by: ["departmentId"], where, _count: true }),
    prisma.feedbackSubmission.findMany({ where: { AND: [where, { resolvedAt: { not: null } }] }, select: { submittedOn: true, resolvedAt: true } }),
    prisma.feedbackSubmission.findMany({ where, select: { submittedOn: true, status: true } }),
    prisma.feedbackCategory.findMany({ select: { id: true, name: true } }),
    prisma.feedbackPriority.findMany({ select: { id: true, name: true, rank: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);

  const s = Object.fromEntries(byStatus.map((r) => [r.status, r._count])) as Partial<Record<Status, number>>;
  const sum = (...keys: Status[]) => keys.reduce((a, k) => a + (s[k] ?? 0), 0);
  const days = resolved.map((r) => (r.resolvedAt!.getTime() - r.submittedOn.getTime()) / 86_400_000);
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name ?? "Not specified";

  // Monthly buckets across the range
  const months: { key: string; label: string; submitted: number; resolved: number }[] = [];
  const cur = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
  while (cur <= range.to) {
    months.push({ key: cur.toISOString().slice(0, 7), label: cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), submitted: 0, resolved: 0 });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  for (const m of monthly) {
    const b = months.find((x) => x.key === m.submittedOn.toISOString().slice(0, 7));
    if (b) { b.submitted++; if (["RESOLVED", "CLOSED"].includes(m.status)) b.resolved++; }
  }

  return {
    total,
    kpis: {
      open: sum("OPEN"),
      inReview: sum("IN_REVIEW"),
      onHold: sum("ON_HOLD"),
      resolved: sum("RESOLVED"),
      closed: sum("CLOSED"),
      avgResolutionDays: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null,
    },
    byStatus: byStatus.map((r) => ({ name: STATUS_LABEL[r.status as Status], value: r._count })).sort((a, b) => b.value - a.value),
    byCategory: byCategory.map((r) => ({ name: name(categories, r.categoryId), value: r._count })).sort((a, b) => b.value - a.value),
    byPriority: byPriority.map((r) => ({ name: name(priorities, r.priorityId), rank: priorities.find((p) => p.id === r.priorityId)?.rank ?? 0, value: r._count })).sort((a, b) => a.rank - b.rank),
    byDepartment: byDept.map((r) => ({ name: name(departments, r.departmentId), value: r._count })).sort((a, b) => b.value - a.value),
    monthly: months.map(({ label, submitted, resolved }) => ({ label, submitted, resolved })),
  };
}
export type Stats = Awaited<ReturnType<typeof getStats>>;
