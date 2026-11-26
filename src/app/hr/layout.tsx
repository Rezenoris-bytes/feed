import { AppShell } from "@/components/shell/app-shell";
import { guardPage } from "@/server/guard";
import { getSetting } from "@/server/admin";
import { getBranding, logoUrl } from "@/server/branding";
import { can } from "@/server/rbac";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const a = await guardPage(["HR", "REVIEWER"]);
  const [company, branding] = await Promise.all([getSetting("company"), getBranding()]);
  const hidden = can(a.roles, "reports.view") ? [] : ["/hr/reports"];
  return <AppShell area="hr" user={{ name: a.displayName }} company={company.name} logo={logoUrl(branding)} hidden={hidden}>{children}</AppShell>;
}