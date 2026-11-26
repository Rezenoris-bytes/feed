import "server-only";
import { notFound } from "next/navigation";
import { HttpError } from "./rbac";
import { ListFilter } from "./feedback";

/** Turns service-layer HttpErrors into a Next 404 page for server components. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try { return await p; } catch (e) { if (e instanceof HttpError) notFound(); throw e; }
}

export function parseFilters(sp: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const r = ListFilter.safeParse(flat);
  return r.success ? r.data : {};
}
