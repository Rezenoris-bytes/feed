import "server-only";
import type { RoleKey } from "@prisma/client";
import { prisma } from "./db";
import { getSetting } from "./admin";

// In-app notifications only. Text carries a reference + event, never feedback content or identity.
type Kind = "feedback.new" | "feedback.high" | "feedback.escalated" | "feedback.assigned" | "feedback.message";
const SETTING: Record<Kind, keyof Awaited<ReturnType<typeof getSetting<"notifications">>>> = {
  "feedback.new": "newFeedback", "feedback.high": "highPriority", "feedback.escalated": "escalation",
  "feedback.assigned": "assignment", "feedback.message": "messages",
};
const enabled = async (kind: Kind) => (await getSetting("notifications"))[SETTING[kind]];

export async function notify(userId: string, kind: Kind, text: string, link?: string) {
  if (!(await enabled(kind))) return;
  await prisma.notification.create({ data: { userId, kind, text, link } });
}

export async function notifyRoles(roles: RoleKey[], kind: Kind, text: string, link?: string) {
  if (!(await enabled(kind))) return;
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null, roles: { some: { role: { key: { in: roles } } } } },
    select: { id: true, roles: { select: { role: { select: { key: true } } } } },
  });
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id, kind, text,
      link: link && u.roles.some((r) => r.role.key === "SUPER_ADMIN") ? link.replace("/hr/cases/", "/admin/feedback/") : link,
    })),
  });
}
