import { PageHeader } from "@/components/shell/app-shell";
import { CaseList } from "@/components/feedback/case-list";
import { guardPage } from "@/server/guard";
import { formOptions, listStaff } from "@/server/feedback";
import { parseFilters } from "@/server/pages";

export default async function Assigned({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await guardPage(["HR", "REVIEWER"]);
  const f = parseFilters(await searchParams);
  const [data, opts] = await Promise.all([listStaff(auth, { status: "open", ...f, assigned: "me" }), formOptions()]);
  return (
    <>
      <PageHeader title="Assigned to me" description="Cases you are currently responsible for." />
      <CaseList data={data} opts={opts} basePath="/hr/assigned" filters={f as Record<string, string>} />
    </>
  );
}