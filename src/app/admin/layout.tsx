import { AppShell } from "@/components/shell/app-shell";
import { guardPage } from "@/server/guard";
import { getSetting } from "@/server/admin";
import { getBranding, logoUrl } from "@/server/branding";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await guardPage(["SUPER_ADMIN"]);
  const [company, branding] = await Promise.all([getSetting("company"), getBranding()]);
  return <AppShell area="admin" user={{ name: a.displayName }} company={company.name} logo={logoUrl(branding)}>{children}</AppShell>;
}