import { PageHeader } from "@/components/shell/app-shell";
import { SecurityPanel } from "@/components/account/security-panel";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";

export default async function Account() {
  const auth = await guardPage(["HR", "REVIEWER"]);
  const others = await prisma.session.count({ where: { userId: auth.userId, id: { not: auth.sessionId }, expiresAt: { gt: new Date() } } });
  return (
    <>
      <PageHeader title="My account" description={auth.displayName} />
      <SecurityPanel otherSessions={others} />
    </>
  );
}