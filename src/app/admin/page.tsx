import { Overview } from "@/components/dashboard/overview";
import { guardPage } from "@/server/guard";
import { getStats, rangeFor } from "@/server/stats";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const auth = await guardPage(["SUPER_ADMIN"]);
  const period = (await searchParams).period ?? "year";
  const stats = await getStats(auth, rangeFor(period));
  return <Overview title="Overview" description="Submissions, investigations and resolution across the company." stats={stats} basePath="/admin" period={period} showDepartments />;
}
