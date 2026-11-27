import "server-only";
import { z } from "zod";
import type { FeedbackStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";

import { can, HttpError, notFound } from "./rbac";
import type { AuthContext } from "./session";
import { notify } from "./notify";
import { REVIEWER_TARGETS, TRANSITIONS, type Status } from "@/lib/feedback-meta";

// ---------------- Staff side ----------------

/** Row-level visibility. HR/Super Admin: all. Reviewer: actively assigned, or own department and non-sensitive. */
export function staffScope(auth: AuthContext): Prisma.FeedbackSubmissionWhereInput {
  if (can(auth.roles, "feedback.read.all")) return {};
  if (can(auth.roles, "feedback.read.assigned")) {
    const or: Prisma.FeedbackSubmissionWhereInput[] = [{ assignments: { some: { assigneeId: auth.userId, active: true } } }];
    if (auth.departmentId) or.push({ departmentId: auth.departmentId, category: { sensitive: false } });
    return { OR: or };
  }
  return { id: "00000000-0000-0000-0000-000000000000" }; // deny
}

export const ListFilter = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(["open", "all", ...(Object.keys(TRANSITIONS) as [Status, ...Status[]])]).optional(),
  category: z.string().uuid().optional(),
  priority: z.string().uuid().optional(),
  department: z.string().uuid().optional(),
  assigned: z.enum(["me"]).optional(),
  kind: z.enum(["anonymous", "confidential"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function listStaff(auth: AuthContext, f: z.infer<typeof ListFilter>) {
  const where: Prisma.FeedbackSubmissionWhereInput = {
    AND: [
      staffScope(auth),
      f.status && f.status !== "all" ? (f.status === "open" ? { status: { in: ["OPEN", "IN_REVIEW", "ON_HOLD"] } } : { status: f.status }) : {},
      f.category ? { categoryId: f.category } : {},
      f.priority ? { priorityId: f.priority } : {},
      f.department ? { departmentId: f.department } : {},
      f.assigned === "me" ? { assignments: { some: { assigneeId: auth.userId, active: true } } } : {},
      f.kind ? { anonymous: f.kind === "anonymous" } : {},
      f.q ? { OR: [{ reference: { contains: f.q.toUpperCase() } }, { title: { contains: f.q } } /* MySQL utf8mb4_unicode_ci collation is already case-insensitive */] } : {},
    ],
  };
  const take = 25, page = f.page ?? 1;
  const [rows, total] = await Promise.all([
    prisma.feedbackSubmission.findMany({
      where, take, skip: (page - 1) * take, orderBy: [{ createdAt: "desc" }],
      select: {
        id: true, reference: true, title: true, status: true, submittedOn: true, anonymous: true,
        category: { select: { name: true, sensitive: true } }, priority: { select: { name: true, rank: true } },
        department: { select: { name: true } },
        assignments: { where: { active: true }, select: { assignee: { select: { displayName: true } } } },
      },
    }),
    prisma.feedbackSubmission.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

/** Case count per status within the caller's scope (for the inbox tabs). */
export async function statusCounts(auth: AuthContext, extra: Prisma.FeedbackSubmissionWhereInput = {}) {
  const rows = await prisma.feedbackSubmission.groupBy({ by: ["status"], where: { AND: [staffScope(auth), extra] }, _count: true });
  const c = Object.fromEntries(rows.map((r) => [r.status, r._count])) as Partial<Record<Status, number>>;
  const n = (s: Status) => c[s] ?? 0;
  return { OPEN: n("OPEN"), IN_REVIEW: n("IN_REVIEW"), ON_HOLD: n("ON_HOLD"), RESOLVED: n("RESOLVED"), CLOSED: n("CLOSED"),
    open: n("OPEN") + n("IN_REVIEW") + n("ON_HOLD"), all: rows.reduce((a, r) => a + r._count, 0) };
}

export async function getStaff(auth: AuthContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const fb = await prisma.feedbackSubmission.findFirst({
    where: { AND: [{ id }, staffScope(auth)] },
    // Explicit select: legacy owner tags and identity tables are never selected for staff views.
    select: {
      id: true, reference: true, title: true, description: true, status: true, submittedOn: true, anonymous: true,
      category: { select: { id: true, name: true, sensitive: true } }, priority: { select: { id: true, name: true, rank: true } },
      department: { select: { id: true, name: true } },
      attachments: { select: { id: true, label: true, mimeType: true, sizeBytes: true } },
      assignments: { orderBy: { createdAt: "desc" }, select: { id: true, active: true, createdAt: true, assignee: { select: { id: true, displayName: true } } } },
      history: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, remarks: true, createdAt: true, actorId: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, author: true, body: true, createdAt: true, staffId: true } },
    },
  });
  if (!fb) throw notFound();
  const staffIds = [...new Set([...fb.history.map((h) => h.actorId), ...fb.messages.map((m) => m.staffId)].filter(Boolean) as string[])];
  const staff = await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, displayName: true } });
  const names = Object.fromEntries(staff.map((s) => [s.id, s.displayName]));
  // Submitter-originated events are coarsened to the day so staff can't correlate timing with presence.
  const day = (d: Date) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
  return {
    ...fb,
    history: fb.history.map((h) => (h.actorId ? h : { ...h, createdAt: day(h.createdAt) })),
    messages: fb.messages.map((m) => (m.author === "EMPLOYEE" ? { ...m, createdAt: day(m.createdAt) } : m)),
    names,
  };
}

async function loadForAction(auth: AuthContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  const fb = await prisma.feedbackSubmission.findFirst({ where: { AND: [{ id }, staffScope(auth)] } });
  if (!fb) throw notFound();
  return fb;
}

export async function changeStatus(auth: AuthContext, id: string, to: Status) {
  const fb = await loadForAction(auth, id);
  const from = fb.status as Status;
  const isSuper = auth.roles.includes("SUPER_ADMIN");
  const isHr = can(auth.roles, "feedback.read.all");
  if (from === to) throw new HttpError(400, "Already in that status");

  const normal = TRANSITIONS[from].includes(to);
  if (!isHr) {
    if (!can(auth.roles, "feedback.status.update") || !REVIEWER_TARGETS.includes(to) || !normal) throw new HttpError(403, "You can't make that change");
  } else if (!normal && !isSuper) {
    throw new HttpError(400, `Can't move from ${from} to ${to}`);
  }
  const override = !normal && isSuper;

  await prisma.$transaction([
    prisma.feedbackSubmission.update({
      where: { id },
      data: { status: to as FeedbackStatus, resolvedAt: to === "RESOLVED" ? new Date() : undefined,
        history: { create: { fromStatus: from as FeedbackStatus, toStatus: to as FeedbackStatus, actorId: auth.userId } } },
    }),
    prisma.auditLog.create({ data: { actorId: auth.userId, action: override ? "feedback.status.override" : "feedback.status", target: id, meta: { from, to } } }),
  ]);
}

export async function assignCase(auth: AuthContext, id: string, assigneeId: string) {
  if (!can(auth.roles, "feedback.assign")) throw notFound();
  const fb = await loadForAction(auth, id);
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, isActive: true, deletedAt: null, roles: { some: { role: { key: { in: ["REVIEWER", "HR"] } } } } },
  });
  if (!assignee) throw new HttpError(400, "Choose an active reviewer");
  const moveToAssigned = fb.status === "OPEN"; // assigning an open case starts the review
  await prisma.$transaction([
    prisma.feedbackAssignment.updateMany({ where: { feedbackId: id, active: true }, data: { active: false } }),
    prisma.feedbackAssignment.create({ data: { feedbackId: id, assigneeId, assignedById: auth.userId } }),
    ...(moveToAssigned ? [prisma.feedbackSubmission.update({ where: { id }, data: { status: "IN_REVIEW", history: { create: { fromStatus: fb.status, toStatus: "IN_REVIEW", actorId: auth.userId, remarks: `Assigned to ${assignee.displayName}` } } } })] : []),
    prisma.auditLog.create({ data: { actorId: auth.userId, action: "feedback.assign", target: id, meta: { assigneeId } } }),
  ]);
  await notify(assigneeId, "feedback.assigned", `${fb.reference} was assigned to you`, `/hr/cases/${id}`);
}

export async function staffMessage(auth: AuthContext, id: string, body: string) {
  if (!can(auth.roles, "feedback.message")) throw notFound();
  const fb = await loadForAction(auth, id);
  if (fb.status === "CLOSED") throw new HttpError(400, "This case is closed");
  await prisma.feedbackMessage.create({ data: { feedbackId: id, author: "STAFF", staffId: auth.userId, body } });
}

export async function canReadAttachment(auth: AuthContext, attachmentId: string) {
  if (!z.string().uuid().safeParse(attachmentId).success) throw notFound();
  const a = await prisma.feedbackAttachment.findUnique({ where: { id: attachmentId }, include: { feedback: { select: { id: true } } } });
  if (!a) throw notFound();
  if (await prisma.feedbackSubmission.findFirst({ where: { AND: [{ id: a.feedback.id }, staffScope(auth)] }, select: { id: true } })) return a;
  throw notFound();
}

export async function assignableStaff() {
  return prisma.user.findMany({
    where: { isActive: true, deletedAt: null, roles: { some: { role: { key: { in: ["REVIEWER", "HR"] } } } } },
    select: { id: true, displayName: true, department: { select: { name: true } } }, orderBy: { displayName: "asc" },
  });
}

export async function formOptions() {
  const [categories, priorities, departments] = await Promise.all([
    prisma.feedbackCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sensitive: true } }),
    prisma.feedbackPriority.findMany({ orderBy: { rank: "asc" }, select: { id: true, name: true, key: true } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, priorities, departments };
}
