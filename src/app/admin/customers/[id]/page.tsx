import { CustomerFormPage } from "@/components/customers/pages";
import { guardPage } from "@/server/guard";

export const metadata = { title: "Customer form" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await guardPage(["SUPER_ADMIN"]);
  return <CustomerFormPage base="/admin/customers" id={(await params).id} tab={(await searchParams).tab} />;
}
