import { PageHeader } from "@/components/shell/app-shell";
import { NotificationForm } from "@/components/admin/settings-forms";
import { guardPage } from "@/server/guard";
import { getSetting } from "@/server/admin";

export default async function NotificationSettings() {
  await guardPage(["SUPER_ADMIN"]);
  return (
    <>
      <PageHeader title="Notifications" description="In-app alerts for staff" />
      <div className="max-w-2xl"><NotificationForm value={await getSetting("notifications")} /></div>
    </>
  );
}