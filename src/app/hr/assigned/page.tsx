import { PageHeader } from "@/components/shell/app-shell";
import { CaseList } from "@/components/feedback/case-list";
import { guardPage } from "@/server/guard";
import { formOptions, listStaff, statusCounts } from "@/server/feedback";
import { parseFilters } from "@/server/pages";

export default async function Assigned({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await guardPage(["HR", "REVIEWER"]);
  const f = parseFilters(await searchParams);
  const [data, opts, counts] = await Promise.all([listStaff(auth, { status: "open", ...f, assigned: "me" }), formOptions(), statusCounts(auth, { assignments: { some: { assigneeId: auth.userId, active: true } } })]);
  return (
    <>
      <PageHeader title="Assigned to me" />
      <CaseList data={data} opts={opts} basePath="/hr/assigned" filters={f as Record<string, string>} counts={counts} />
    </>
  );
}