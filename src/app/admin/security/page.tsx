import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityPanel } from "@/components/account/security-panel";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";

export default async function Security() {
  const auth = await guardPage(["SUPER_ADMIN"]);
  const [others, locked, noMfa] = await Promise.all([
    prisma.session.count({ where: { userId: auth.userId, id: { not: auth.sessionId }, expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
    prisma.user.count({ where: { mfaEnabled: false, roles: { some: { role: { key: "SUPER_ADMIN" } } } } }),
  ]);
  return (
    <>
      <PageHeader title="Security" description="Your account security and system-wide protections." />
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Protections in place</CardTitle><CardDescription>These are enforced by the server and can&apos;t be switched off here.</CardDescription></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <p>Authenticator code required for every Super Admin sign-in</p>
          <p>Identity reveal needs a reason and a code from the last 5 minutes</p>
          <p>Accounts lock for 15 minutes after 5 wrong passwords</p>
          <p>Sessions expire after 8 hours</p>
          <p>Identity mapping and attachments encrypted (AES-256-GCM)</p>
          <p>Audit and identity logs can&apos;t be edited or deleted</p>
          <p className="text-muted-foreground">Accounts currently locked: {locked}</p>
          <p className="text-muted-foreground">Super Admins without an authenticator: {noMfa}</p>
        </CardContent>
      </Card>
      <SecurityPanel otherSessions={others} />
    </>
  );
}