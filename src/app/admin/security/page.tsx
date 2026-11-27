import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityPanel } from "@/components/account/security-panel";
import { MfaPolicyForm } from "@/components/admin/mfa-policy-form";
import { guardPage } from "@/server/guard";
import { prisma } from "@/server/db";
import { adminMfaRequired } from "@/server/mfa-policy";

export default async function Security() {
  const auth = await guardPage(["SUPER_ADMIN"]);
  const [others, locked, me, mfaRequired] = await Promise.all([
    prisma.session.count({ where: { userId: auth.userId, id: { not: auth.sessionId }, expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
    prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { mfaEnabled: true } }),
    adminMfaRequired(),
  ]);
  return (
    <>
      <PageHeader title="Security" />
      <MfaPolicyForm required={mfaRequired} enrolled={me.mfaEnabled} />
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Protections in place</CardTitle><CardDescription>Enforced by the server.</CardDescription></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <p>Employees submit without accounts; no identity is stored</p>
          <p>Accounts lock for 15 minutes after 5 wrong passwords</p>
          <p>Sessions expire after 8 hours</p>
          <p>Attachments encrypted (AES-256-GCM), metadata removed</p>
          <p>Audit log can&apos;t be edited or deleted by the app</p>
          <p>Authenticator code for Super Admins: <span className={mfaRequired ? "" : "font-medium text-amber-700 dark:text-amber-300"}>{mfaRequired ? "required" : "OFF"}</span></p>
          <p className="text-muted-foreground">Accounts currently locked: {locked}</p>
        </CardContent>
      </Card>
      <SecurityPanel otherSessions={others} />
    </>
  );
}
