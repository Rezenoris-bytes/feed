import { expect, test } from "@playwright/test";
import { anon, as, caseIdFor, options, pow, submit, track } from "./helpers";
import { prisma, TEST_ANON_SETTINGS } from "./fixtures";

test.describe.configure({ mode: "serial" });

const setAnon = (value: { accessCode: string; hourlyLimit: number }) =>
  prisma.systemSetting.upsert({ where: { key: "anonymous" }, update: { value }, create: { key: "anonymous", value } });

let reference = "", key = "", caseId = "";

test("submits without login and gets a reference + secret key", async () => {
  const o = await options(await as("hr"));
  const s = await submit(o, { title: "Unsafe ladder in warehouse", department: o.department("Warehouse") });
  expect(s.res.status()).toBe(201);
  ({ reference, key } = s);
  expect(key).toMatch(/^([2-9A-Z]{4}-){4}[2-9A-Z]{4}$/);
  caseId = await caseIdFor(await as("hr"), reference);
  expect(caseId).toBeTruthy();
});

test("access code, anti-bot proof and replay protection are enforced", async () => {
  await setAnon({ accessCode: "E2E-CODE", hourlyLimit: 1000 });
  try {
    const ctx = await anon();
    const o = await options(await as("hr"));
    const base = {
      title: "[e2e] code test", description: "Testing the company access code requirement here.",
      categoryId: o.category("Other"), priorityId: o.priority("Low"), departmentId: "",
    };
    const p1 = await pow(ctx);
    expect((await ctx.post("/api/anonymous", { multipart: { ...base, ...p1, accessCode: "WRONG" } })).status()).toBe(403);
    expect((await ctx.post("/api/anonymous", { multipart: { ...base, ...(await pow(ctx)), counter: "0", accessCode: "e2e-code" } })).status()).toBe(400);
    const p2 = await pow(ctx);
    expect((await ctx.post("/api/anonymous", { multipart: { ...base, ...p2, accessCode: "e2e-code" } })).status()).toBe(201);
    expect((await ctx.post("/api/anonymous", { multipart: { ...base, ...p2, accessCode: "e2e-code" } })).status()).toBe(400);
    expect(await (await ctx.get("/submit")).text()).toMatch(/requireCode\\+":true/); // form will ask for the code
  } finally {
    await setAnon(TEST_ANON_SETTINGS);
  }
});

test("company-wide hourly cap stops floods", async () => {
  await setAnon({ accessCode: "", hourlyLimit: 1 });
  try {
    const o = await options(await as("hr"));
    // Earlier submissions this hour already exceed a cap of 1.
    expect((await submit(o, { title: "flood" })).res.status()).toBe(429);
  } finally {
    await setAnon(TEST_ANON_SETTINGS);
  }
});

test("tracking: wrong key fails with the same message as an unknown reference", async () => {
  const ctx = await anon();
  const wrong = await ctx.post("/api/anonymous/track", { data: { reference, key: "AAAA-AAAA-AAAA-AAAA-AAAA" } });
  const unknown = await ctx.post("/api/anonymous/track", { data: { reference: "FB-2222-3333-4444", key } });
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).error).toBe((await unknown.json()).error);
  expect((await ctx.get(`/track/${reference}`, { maxRedirects: 0 })).status()).toBe(307);
});

test("tracking: right key opens the case; replies go both ways; internals stay hidden; Lock works", async () => {
  const hr = await as("hr");
  await hr.post(`/api/cases/${caseId}`, { data: { action: "status", to: "RECEIVED" } });
  await hr.post(`/api/cases/${caseId}`, { data: { action: "message", body: "Thanks, we've taken the ladder out of use." } });

  const ctx = await track(reference.toLowerCase(), key.toLowerCase().replace(/-/g, " "));
  const page = await (await ctx.get(`/track/${reference}`)).text();
  expect(page).toContain("taken the ladder out of use");
  expect(page).toContain("Feedback team");
  expect(page).not.toContain("E2E HR Person");

  expect((await ctx.post("/api/anonymous/messages", { data: { reference, body: "There's a second one in aisle 7." } })).status()).toBe(200);
  expect(await (await hr.get(`/hr/cases/${caseId}`)).text()).toContain("second one in aisle 7");

  expect((await ctx.delete("/api/anonymous/track")).status()).toBe(200);
  expect((await ctx.get(`/track/${reference}`, { maxRedirects: 0 })).status()).toBe(307);
  expect((await ctx.post("/api/anonymous/messages", { data: { reference, body: "x" } })).status()).toBe(401);
});

test("tracking is rate limited per reference (brute force)", async () => {
  const o = await options(await as("hr"));
  const { reference: r } = await submit(o, { title: "brute target" });
  const ctx = await anon();
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await ctx.post("/api/anonymous/track", { data: { reference: r, key: `ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZ${(i % 8) + 2}` } })).status());
  expect(codes.at(-1)).toBe(429);
});

test("HR can filter by type; exports label anonymous cases", async () => {
  const hr = await as("hr");
  expect(await (await hr.get(`/hr/inbox?status=all&kind=anonymous&q=${reference}`)).text()).toContain(reference);
  expect(await (await hr.get(`/hr/inbox?status=all&kind=confidential&q=${reference}`)).text()).toContain("No feedback found");
  expect(await (await hr.get("/api/reports?format=csv&period=year")).text()).toContain(`${reference},Anonymous`);
});

test("public pages are reachable without login", async () => {
  const ctx = await anon();
  for (const p of ["/", "/submit", "/track"]) expect((await ctx.get(p)).status(), p).toBe(200);
  expect(await (await ctx.get("/login")).text()).toContain("Send feedback");
});
