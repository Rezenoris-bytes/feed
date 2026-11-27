import { Overview } from "@/components/dashboard/overview";
import { guardPage } from "@/server/guard";
import { getStats, rangeFor } from "@/server/stats";
import { can } from "@/server/rbac";

export default async function HrHome({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const auth = await guardPage(["HR", "REVIEWER"]);
  const period = (await searchParams).period ?? "year";
  const stats = await getStats(auth, rangeFor(period));
  const hr = can(auth.roles, "feedback.read.all");
  return (
    <Overview title={hr ? "Overview" : "My cases"} stats={stats} basePath="/hr" period={period} showDepartments={hr} inboxPath="/hr/inbox" />
  );
}
