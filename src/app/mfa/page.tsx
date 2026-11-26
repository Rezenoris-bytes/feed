import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { MfaForm } from "@/components/auth/mfa-form";
import { getAuth } from "@/server/session";

export default async function MfaPage() {
  if (!(await getAuth())) redirect("/login");
  return (
    <AuthCard title="Two-step verification" description="Enter the code from your authenticator app.">
      <MfaForm />
    </AuthCard>
  );
}
