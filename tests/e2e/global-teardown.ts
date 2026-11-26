import { existsSync, readFileSync, rmSync } from "node:fs";
import { E2E_DOMAIN, E2E_TAG, prisma, STATE_DIR } from "./fixtures";

/** Removes e2e accounts and the feedback they created, and restores the real anonymous settings. Audit logs stay (append-only). */
export default async function globalTeardown() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@" + E2E_DOMAIN } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.$transaction(async (tx) => {
    const fb = await tx.feedbackSubmission.findMany({ where: { title: { startsWith: E2E_TAG } }, select: { id: true } });
    await tx.feedbackSubmission.deleteMany({ where: { id: { in: fb.map((f) => f.id) } } });
    await tx.feedbackAssignment.deleteMany({ where: { assigneeId: { in: ids } } });
    await tx.notification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { text: { contains: "FB-" }, link: { contains: "e2e" } }] } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
  const saved = `${STATE_DIR}/anon-settings.json`;
  if (existsSync(saved)) {
    const prev = JSON.parse(readFileSync(saved, "utf8"));
    if (prev) await prisma.systemSetting.update({ where: { key: "anonymous" }, data: { value: prev } });
    else await prisma.systemSetting.deleteMany({ where: { key: "anonymous" } });
    rmSync(saved);
  }
}
