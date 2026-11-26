import { PageHeader } from "@/components/shell/app-shell";
import { CaseList } from "@/components/feedback/case-list";
import { guardPage } from "@/server/guard";
import { formOptions, listStaff } from "@/server/feedback";
import { parseFilters } from "@/server/pages";

export default async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await guardPage(["HR", "REVIEWER"]);
  const f = parseFilters(await searchParams);
  const [data, opts] = await Promise.all([listStaff(auth, { status: "open", ...f }), formOptions()]);
  return (
    <>
      <PageHeader title="Feedback inbox" description="Submitter identities are never shown here." />
      <CaseList data={data} opts={opts} basePath="/hr/inbox" filters={f as Record<string, string>} />
    </>
  );
}