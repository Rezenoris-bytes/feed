import { expect, test } from "@playwright/test";
import { anon, as } from "./helpers";
import { E2E_TAG, prisma } from "./fixtures";
import { TEMPLATES } from "../../src/lib/customer-forms";

const machine = () => { const t = TEMPLATES.find((x) => x.key === "machine")!.build(); return { ...t, title: `${E2E_TAG} ${t.title}` }; };

test("customer form: build, publish, send, answer once, read replies", async () => {
  const [hr, rev] = await Promise.all([as("hr"), as("reviewer")]);

  // Reviewers can't touch customer forms (404, not 403).
  expect((await rev.post("/api/customer-forms", { data: machine() })).status()).toBe(404);
  expect((await rev.get("/hr/customers")).url()).not.toContain("/hr/customers");

  const body = machine();
  const created = await hr.post("/api/customer-forms", { data: body });
  expect(created.status()).toBe(200);
  const { id } = await created.json();

  // A draft can't be sent.
  const send = (data: object) => hr.post(`/api/customer-forms/${id}/sends`, { data });
  expect((await send({ customerName: "Ravi Kumar", days: 30 })).status()).toBe(409);
  expect((await hr.patch(`/api/customer-forms/${id}`, { data: { status: "ACTIVE" } })).status()).toBe(200);

  // Validation: bad phone, email requested without address / without SMTP.
  expect((await send({ customerName: "Ravi", phone: "call me", days: 30 })).status()).toBe(400);
  const r = await send({ customerName: "Ravi Kumar", company: "Acme Tools", phone: "+91 98765 43210", machine: "LX-200 #A1234", days: 30 });
  expect(r.status()).toBe(200);
  const { link, message, emailed } = await r.json();
  expect(emailed).toBe(false);
  expect(message).toContain("Ravi Kumar");
  expect(message).toContain("LX-200");
  const token = link.split("/f/")[1];
  expect(token.length).toBeGreaterThan(20);

  // The token is never stored in plain text.
  const row = await prisma.customerFormSend.findFirstOrThrow({ where: { formId: id } });
  expect(row.tokenHash).not.toContain(token);
  expect(row.tokenEnc).not.toContain(token);

  // Customer opens the page (no login).
  const customer = await anon();
  const page = await customer.get(`/f/${token}`);
  expect(page.status()).toBe(200);
  const html = await page.text();
  expect(html).toContain("Hi Ravi Kumar");
  expect(html).toContain(body.fields[0].label.replace(/'/g, "&#x27;"));
  expect((await prisma.customerFormSend.findUniqueOrThrow({ where: { id: row.id } })).openedAt).not.toBeNull();
  expect((await customer.get(`/f/not-a-real-token-at-all-123`)).status()).toBe(404);

  // Required question missing → 400 with the field; invalid rating → 400.
  const [q1, q2, q3] = body.fields;
  const post = (data: object) => customer.post(`/api/f/${token}`, { data });
  const miss = await post({ [q2.id]: 4 });
  expect(miss.status()).toBe(400);
  expect((await miss.json()).field).toBe(q1.id);
  expect((await post({ [q1.id]: 9 })).status()).toBe(400);
  expect((await post({ [q1.id]: 5, [q3.id]: "Not an option" })).status()).toBe(400);

  const ok = await post({ [q1.id]: 5, [q2.id]: 4, [q3.id]: "Every day", unknownField: "ignored" });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).thanks).toBe(body.thanks);

  // Works once.
  expect((await post({ [q1.id]: 1 })).status()).toBe(409);
  expect(await (await customer.get(`/f/${token}`)).text()).toContain("Already answered");
  const resp = await prisma.customerFormResponse.findUniqueOrThrow({ where: { sendId: row.id } });
  expect(resp.answers).toEqual({ [q1.id]: 5, [q2.id]: 4, [q3.id]: "Every day" });

  // Staff see the reply and a notification.
  const replies = await (await hr.get(`/hr/customers/${id}?tab=responses`)).text();
  expect(replies).toContain("Ravi Kumar");
  expect(replies).toContain("Every day");
  expect(await prisma.notification.count({ where: { kind: "customer.response", text: { contains: E2E_TAG } } })).toBeGreaterThan(0);

  // Link can be fetched again for copy/WhatsApp; withdrawing an answered link is refused.
  expect((await (await hr.get(`/api/customer-sends/${row.id}`)).json()).link).toBe(link);
  expect((await hr.post(`/api/customer-sends/${row.id}`, { data: { action: "revoke" } })).status()).toBe(409);

  // Withdrawn and expired links stop working.
  const r2 = await (await send({ customerName: "Second Customer", days: 7 })).json();
  const t2 = r2.link.split("/f/")[1];
  const s2 = await prisma.customerFormSend.findFirstOrThrow({ where: { formId: id, customerName: "Second Customer" } });
  expect((await hr.post(`/api/customer-sends/${s2.id}`, { data: { action: "revoke" } })).status()).toBe(200);
  expect(await (await customer.get(`/f/${t2}`)).text()).toContain("no longer active");
  expect((await customer.post(`/api/f/${t2}`, { data: { [q1.id]: 5 } })).status()).toBe(409);

  // A sent form can't be deleted (archive instead); a reviewer can't read the replies page.
  expect((await hr.delete(`/api/customer-forms/${id}`)).status()).toBe(409);
  expect(await (await rev.get(`/hr/customers/${id}?tab=responses`)).text()).not.toContain("Ravi Kumar");

  // Audit trail exists.
  expect(await prisma.auditLog.count({ where: { action: { startsWith: "customers." }, target: { in: [id, row.id, s2.id] } } })).toBeGreaterThanOrEqual(4);
});

test("customer form: questions are validated", async () => {
  const hr = await as("hr");
  const bad = (fields: object[]) => hr.post("/api/customer-forms", { data: { title: `${E2E_TAG} Bad`, fields } });
  expect((await bad([])).status()).toBe(400);
  expect((await bad([{ id: "abc12345", type: "choice", label: "Pick", options: ["Only one"] }])).status()).toBe(400);
  expect((await bad([{ id: "abc12345", type: "script", label: "x" }])).status()).toBe(400);
  expect((await bad([{ id: "abc12345", type: "short", label: "Name" }])).status()).toBe(200);
});
