import { CaseDetail } from "@/components/feedback/case-detail";
import { guardPage } from "@/server/guard";
import { assignableStaff, getStaff } from "@/server/feedback";
import { orNotFound } from "@/server/pages";

export default async function HrCase({ params }: { params: Promise<{ id: string }> }) {
  const auth = await guardPage(["HR", "REVIEWER"]);
  const { id } = await params;
  const [fb, staff] = await Promise.all([orNotFound(getStaff(auth, id)), assignableStaff()]);
  return <CaseDetail fb={fb} auth={auth} staff={staff} backHref="/hr/inbox" />;
}