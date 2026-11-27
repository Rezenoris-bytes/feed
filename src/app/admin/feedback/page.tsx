import { PageHeader } from "@/components/shell/app-shell";
import { CaseList } from "@/components/feedback/case-list";
import { guardPage } from "@/server/guard";
import { formOptions, listStaff, statusCounts } from "@/server/feedback";
import { parseFilters } from "@/server/pages";

export default async function AllFeedback({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await guardPage(["SUPER_ADMIN"]);
  const f = parseFilters(await searchParams);
  const [data, opts, counts] = await Promise.all([listStaff(auth, { status: "open", ...f }), formOptions(), statusCounts(auth)]);
  return (
    <>
      <PageHeader title="All feedback" />
      <CaseList data={data} opts={opts} basePath="/admin/feedback" filters={f as Record<string, string>} counts={counts} />
    </>
  );
}