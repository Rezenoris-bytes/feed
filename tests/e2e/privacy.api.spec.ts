import { expect, test, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";
import { anon, as, caseIdFor, options, submit, track } from "./helpers";
import { accounts, prisma } from "./fixtures";

// MANDATORY privacy suite: employees submit without login, so nothing about them may be stored or shown anywhere.
test.describe.configure({ mode: "serial" });

const MARKER = `ZQX${Date.now()}`; // planted in every device-identifying header we can send
let hr: APIRequestContext, rev: APIRequestContext, other: APIRequestContext, sup: APIRequestContext;
let reference = "", key = "", caseId = "", attachmentId = "";

test.beforeAll(async () => {
  [hr, rev, other, sup] = await Promise.all([as("hr"), as("reviewer"), as("otherReviewer"), as("super")]);
  const o = await options(hr);
  const jpeg = await sharp({ create: { width: 30, height: 30, channels: 3, background: "#888" } })
    .jpeg().withExif({ IFD0: { Artist: `Jane ${MARKER}`, ImageDescription: `jane.${MARKER}@example.com` } }).toBuffer();
  const sender = await anon({
    "User-Agent": `Mozilla/5.0 ${MARKER}`, "X-Forwarded-For": "203.0.113.77", "X-Real-IP": "203.0.113.77",
    "Accept-Language": `en-${MARKER}`, Cookie: `tracker=${MARKER}`,
  });
  const s = await submit(o, { ctx: sender, title: "Manager shouts at team", category: "Management concern",
    files: [{ name: `jane_${MARKER}_evidence.jpg`, mimeType: "image/jpeg", buffer: jpeg }] });
  expect(s.res.status()).toBe(201);
  ({ reference, key } = s);
  caseId = await caseIdFor(hr, reference);
  attachmentId = (await (await hr.get(`/hr/cases/${caseId}`)).text()).match(/\/api\/attachments\/([0-9a-f-]{36})/)![1];
});

test("no device data is stored anywhere in the database (IP, user agent, language, cookies, file names, EXIF)", async () => {
  // Dump every text column of every table and search for the planted marker and IP.
  const tables = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.columns
     WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE IN ('char','varchar','text','mediumtext','longtext','json')`);
  for (const { table_name, column_name } of tables) {
    const hits = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM \`${table_name}\` WHERE CAST(\`${column_name}\` AS CHAR) LIKE ? OR CAST(\`${column_name}\` AS CHAR) LIKE ?`, `%${MARKER}%`, "%203.0.113.77%");
    expect(Number(hits[0].n), `${table_name}.${column_name}`).toBe(0);
  }
});

test("the case row carries no owner and has no identity mapping", async () => {
  const fb = await prisma.feedbackSubmission.findUnique({ where: { id: caseId } });
  expect(fb!.anonymous).toBe(true);
  expect(fb!.ownerHmac).toBeNull();
  expect(fb!.trackingKeyHash).not.toContain(key);
  expect(await prisma.feedbackIdentityMapping.count({ where: { feedbackId: caseId } })).toBe(0);
  await expect(prisma.feedbackIdentityMapping.create({ data: { feedbackId: caseId, userIdEnc: "a.b.c" } })).rejects.toThrow(/anonymous/);
});

test("reference number reveals nothing", () => {
  expect(reference).toMatch(/^FB-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
});

test("attachment: EXIF and original filename are gone", async () => {
  const res = await hr.get(`/api/attachments/${attachmentId}`);
  expect(res.status()).toBe(200);
  const buf = await res.body();
  expect((await sharp(buf).metadata()).exif).toBeUndefined();
  expect(buf.toString("latin1")).not.toContain(MARKER);
  expect(res.headers()["content-disposition"]).not.toContain(MARKER);
});

test("there is no identity-reveal feature for anyone, including Super Admin", async () => {
  for (const ctx of [hr, rev, sup]) {
    expect((await ctx.post(`/api/admin/feedback/${caseId}/identity`, { data: { reason: "x".repeat(30) } })).status()).toBe(404);
  }
  expect(await (await sup.get(`/admin/feedback/${caseId}`)).text()).not.toContain("Reveal submitter");
  expect((await sup.get("/admin/identity", { maxRedirects: 0 })).status()).toBe(404);
});

test("employees have no login: old employee accounts are refused, employee pages are gone", async () => {
  const a = accounts().legacyEmployee;
  const res = await (await anon()).post("/api/auth/login", { data: { email: a.email, password: a.password } });
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toBe("Email or password is incorrect");
  for (const p of ["/submissions", "/account", "/api/feedback"]) expect((await (await anon()).get(p)).status(), p).toBe(404);
});

test("reports and notifications contain no feedback text", async () => {
  const csv = await (await hr.get("/api/reports?format=csv&period=year")).text();
  expect(csv).not.toContain("broken for over a week");
  for (const ctx of [hr, sup]) expect(await (await ctx.get("/api/notifications")).text()).not.toContain("shouts");
});

test("reviewer from another department can't see the case", async () => {
  expect((await other.get(`/hr/cases/${caseId}`)).status()).toBe(404);
  expect((await other.get(`/api/attachments/${attachmentId}`)).status()).toBe(404);
  expect((await other.post(`/api/cases/${caseId}`, { data: { action: "message", body: "x" } })).status()).toBe(404);
});

test("a tracking session only opens its own case and attachments", async () => {
  const o = await options(hr);
  const second = await submit(o, { title: "Another person's case" });
  const mine = await track(reference, key);
  expect((await mine.get(`/track/${reference}`)).status()).toBe(200);
  expect((await mine.get(`/track/${second.reference}`, { maxRedirects: 0 })).status()).toBe(307);
  const otherCaseId = await caseIdFor(hr, second.reference);
  expect(otherCaseId).toBeTruthy();
  expect((await mine.get(`/api/attachments/${attachmentId}`)).status()).toBe(200);
  expect((await mine.get("/hr/inbox", { maxRedirects: 0 })).status()).toBe(307); // tracking is not a staff login
});

test("staff see the submission date only (no time of day)", async () => {
  const html = (await (await hr.get(`/hr/cases/${caseId}`)).text()).replace(/<!-- -->/g, "");
  const m = html.match(/>Open<\/div><div[^>]*>Sender · ([^<]+)</);
  expect(m?.[1]).toMatch(/^\d{1,2} \w{3} \d{4}$/);
});
