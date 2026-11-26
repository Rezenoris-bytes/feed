import { PageHeader } from "@/components/shell/app-shell";
import { NotificationForm } from "@/components/admin/settings-forms";
import { guardPage } from "@/server/guard";
import { getSetting } from "@/server/admin";

export default async function NotificationSettings() {
  await guardPage(["SUPER_ADMIN"]);
  return (
    <>
      <PageHeader title="Notifications" description="Choose which events create in-app notifications. Feed doesn't send emails, so nothing leaves this server." />
      <div className="max-w-2xl"><NotificationForm value={await getSetting("notifications")} /></div>
    </>
  );
}