import { headers } from "next/headers";
import { PageHeader } from "@/components/shell/app-shell";
import { AnonymousForm, CompanyForm, LogoForm } from "@/components/admin/settings-forms";
import { getBranding, logoUrl } from "@/server/branding";
import { guardPage } from "@/server/guard";
import { getSetting } from "@/server/admin";

export default async function Settings() {
  await guardPage(["SUPER_ADMIN"]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [company, anonymous, branding] = await Promise.all([getSetting("company"), getSetting("anonymous"), getBranding()]);
  return (
    <>
      <PageHeader title="System settings" description="Organisation-wide configuration. Changes are recorded in the audit log." />
      <div className="grid max-w-2xl gap-6">
        <CompanyForm value={company} />
        <LogoForm logo={logoUrl(branding)} company={company.name} />
        <AnonymousForm value={anonymous} origin={origin} />
      </div>
    </>
  );
}