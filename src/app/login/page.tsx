import { LoginForm } from "@/components/auth/login-form";
import { getSetting } from "@/server/admin";
import { getBranding, logoUrl } from "@/server/branding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff sign in" };

export default async function LoginPage() {
  const [company, branding] = await Promise.all([getSetting("company"), getBranding()]);
  return <LoginForm logo={logoUrl(branding)} company={company.name} />;
}