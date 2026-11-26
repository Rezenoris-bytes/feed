import { redirect } from "next/navigation";
import { ReportsView } from "@/components/dashboard/reports-view";
import { guardPage } from "@/server/guard";
import { can } from "@/server/rbac";
import { getStats, rangeFor } from "@/server/stats";

export default async function Reports({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const auth = await guardPage(["SUPER_ADMIN"]);
  if (!can(auth.roles, "reports.view")) redirect("/admin");
  const period = (await searchParams).period ?? "month";
  const range = rangeFor(period);
  return <ReportsView stats={await getStats(auth, range)} period={period} label={range.label} basePath="/admin/reports" />;
}