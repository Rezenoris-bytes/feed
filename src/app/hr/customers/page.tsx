import { ArchivedForms, CustomersHome } from "@/components/customers/pages";
import { guardPage } from "@/server/guard";

export const metadata = { title: "Customer forms" };

export default async function Page({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  await guardPage(["HR"]);
  return (await searchParams).archived ? <ArchivedForms base="/hr/customers" /> : <CustomersHome base="/hr/customers" />;
}
