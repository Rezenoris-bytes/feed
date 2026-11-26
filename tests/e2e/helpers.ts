import { request, type APIRequestContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { BASE } from "../../playwright.config";
import { accounts, E2E_TAG, statePath, type E2ERole } from "./fixtures";

export async function as(role: E2ERole): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE }, storageState: statePath(role) });
}
export const anon = (headers: Record<string, string> = {}) => request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE, ...headers } });

/** Reads category/priority/department ids from the HR inbox filter (same options employees see). */
export async function options(hr: APIRequestContext) {
  const html = await (await hr.get("/hr/inbox")).text();
  const id = (label: string) => html.match(new RegExp(`<option value="([0-9a-f-]{36})">${label.replace(/[()]/g, "\\$&")}</option>`))?.[1] ?? "";
  return { category: id, priority: id, department: id };
}
export type Options = Awaited<ReturnType<typeof options>>;

function zeroBits(b: Buffer) { let n = 0; for (const x of b) { if (x === 0) { n += 8; continue; } return n + Math.clz32(x) - 24; } return n; }
/** Solves the anti-bot proof-of-work exactly like the browser does. */
export async function pow(ctx: APIRequestContext) {
  const { challenge, difficulty } = await (await ctx.get("/api/anonymous/challenge")).json();
  for (let i = 0; ; i++) if (zeroBits(createHash("sha256").update(`${challenge}:${i}`).digest()) >= difficulty) return { challenge, counter: String(i) };
}

/** Submits feedback the only way employees can: anonymously, without login. */
export async function submit(o: Options, extra: {
  title?: string; category?: string; priority?: string; department?: string; description?: string;
  files?: { name: string; mimeType: string; buffer: Buffer }[]; ctx?: APIRequestContext; fields?: Record<string, string>;
} = {}) {
  const ctx = extra.ctx ?? (await anon());
  const res = await ctx.post("/api/anonymous", {
    multipart: {
      title: `${E2E_TAG} ${extra.title ?? "Broken air conditioning"}`,
      description: extra.description ?? "The air conditioning on the second floor has been broken for over a week.",
      categoryId: o.category(extra.category ?? "Work environment"),
      priorityId: o.priority(extra.priority ?? "Medium"),
      departmentId: extra.department === undefined ? o.department("Operations") : extra.department,
      accessCode: "", ...(await pow(ctx)), ...(extra.fields ?? {}),
      ...(extra.files ? { files: extra.files[0] } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, reference: body.reference as string, key: body.key as string };
}

/** Opens a tracking session for an anonymous case (what the employee does on /track). */
export async function track(reference: string, key: string) {
  const ctx = await anon();
  const r = await ctx.post("/api/anonymous/track", { data: { reference, key } });
  if (!r.ok()) throw new Error("tracking failed " + r.status());
  return ctx;
}

export async function caseIdFor(hr: APIRequestContext, reference: string) {
  const html = await (await hr.get(`/hr/inbox?status=all&q=${reference}`)).text();
  return html.match(/\/hr\/cases\/([0-9a-f-]{36})/)?.[1] ?? "";
}

export { accounts };
