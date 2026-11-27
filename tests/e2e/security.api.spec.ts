import { expect, test, request } from "@playwright/test";
import { accounts, anon, as, caseIdFor, options, submit } from "./helpers";
import { BASE } from "../../playwright.config";
import { prisma } from "./fixtures";

test("security headers are set", async () => {
  const h = (await (await anon()).get("/")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("staff session cookie is HttpOnly + SameSite=Strict; over HTTPS it is also Secure and __Host- prefixed", async () => {
  const cookie = (await (await as("hr")).storageState()).cookies.find((c) => c.name.includes("feed_sid"))!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  // Behind an HTTPS proxy (Caddy sets X-Forwarded-Proto: https) the cookie must be Secure + __Host-.
  const a = accounts().hr;
  const viaHttps = await (await anon({ "X-Forwarded-Proto": "https" })).post("/api/auth/login", { data: { email: a.email, password: a.password } });
  const setCookie = viaHttps.headers()["set-cookie"] ?? "";
  expect(setCookie).toContain("__Host-feed_sid=");
  expect(setCookie).toMatch(/;\s*Secure/i);
  expect(setCookie).toMatch(/;\s*HttpOnly/i);
});

test("unknown email and wrong password give the same message (no account enumeration)", async () => {
  const ctx = await anon();
  const a = await (await ctx.post("/api/auth/login", { data: { email: "ghost-1@e2e.feed.test", password: "x" } })).json();
  const b = await (await ctx.post("/api/auth/login", { data: { email: "ghost-2@e2e.feed.test", password: "y" } })).json();
  expect(a.error).toBe("Email or password is incorrect");
  expect(b.error).toBe(a.error);
});

test("brute force on staff login is rate limited", async () => {
  const ctx = await anon();
  const email = `brute-${Date.now()}@e2e.feed.test`;
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await ctx.post("/api/auth/login", { data: { email, password: "guess" + i } })).status());
  expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
  expect(codes.at(-1)).toBe(429);
});

test("session fixation: a pre-set cookie is not adopted", async () => {
  const fixed = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE, Cookie: "__Host-feed_sid=attacker-chosen-value; feed_sid=attacker-chosen-value" } });
  expect((await fixed.get("/hr", { maxRedirects: 0 })).status()).toBe(307);
});

test("CSRF: cross-origin and origin-less mutations are rejected", async () => {
  const hr = await as("hr");
  expect((await hr.post("/api/cases/00000000-0000-0000-0000-000000000000", { data: { action: "message", body: "x" }, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  expect((await hr.fetch("/api/notifications", { method: "POST", headers: { Origin: "" } })).status()).toBe(403);
  expect((await (await anon({ Origin: "https://evil.example" })).post("/api/anonymous/track", { data: { reference: "FB-2222-2222-2222", key: "x" } })).status()).toBe(403);
});

test("privilege escalation: HR and reviewers can't use admin APIs or create Super Admins or employees", async () => {
  for (const r of ["hr", "reviewer"] as const) {
    const ctx = await as(r);
    expect((await ctx.post("/api/admin/manage", { data: { action: "user.create", role: "HR", email: `esc-${r}@e2e.feed.test`, name: "Escalate" } })).status(), r).toBe(404);
    expect((await ctx.get("/admin", { maxRedirects: 0 })).status(), r).toBe(307);
  }
  const sup = await as("super");
  for (const role of ["SUPER_ADMIN", "EMPLOYEE"]) {
    expect((await sup.post("/api/admin/manage", { data: { action: "user.create", role, email: `mint-${role}@e2e.feed.test`, name: "Mint" } })).status(), role).toBe(400);
  }
});

test("forged fields in an anonymous submission are ignored", async () => {
  const hr = await as("hr");
  const o = await options(hr);
  const s = await submit(o, { title: "forge attempt", fields: { status: "CLOSED", anonymous: "false", ownerHmac: "x", trackingKeyHash: "x", role: "SUPER_ADMIN" } });
  expect(s.res.status()).toBe(201);
  const id = await caseIdFor(hr, s.reference);
  expect(id).toBeTruthy();
  expect((await prisma.feedbackSubmission.findUnique({ where: { id } }))!.status).toBe("OPEN"); // forged status ignored
});

test("SQL injection in search is treated as text", async () => {
  const res = await (await as("hr")).get(`/hr/inbox?status=all&q=${encodeURIComponent("' OR 1=1; DROP TABLE users; --")}`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Nothing here");
});

test("stored XSS in anonymous titles is escaped", async () => {
  const hr = await as("hr");
  const { reference } = await submit(await options(hr), { title: "<img src=x onerror=alert(1)><script>alert(2)</script>" });
  const html = await (await hr.get(`/hr/cases/${await caseIdFor(hr, reference)}`)).text();
  expect(html).not.toContain("<script>alert(2)</script>");
  expect(html).not.toContain("<img src=x onerror");
  expect(html).toContain("&lt;script&gt;");
});

test("invalid ids and malformed input don't leak internals", async () => {
  const hr = await as("hr");
  for (const path of ["/api/cases/not-a-uuid", "/api/attachments/..%2F..%2F.env"]) {
    const res = await hr.post(path, { data: { action: "message", body: "x" } });
    expect(res.status(), path).toBeGreaterThanOrEqual(400);
    expect(await res.text()).not.toMatch(/prisma|stack|at .*\.ts|postgres|SELECT/i);
  }
  expect((await hr.post("/api/cases/00000000-0000-0000-0000-000000000000", { data: { action: "status", to: "NOPE" } })).status()).toBe(400);
  const bad = await (await anon()).post("/api/anonymous", { multipart: { title: "" } });
  expect(bad.status()).toBe(400);
  expect(await bad.text()).not.toMatch(/prisma|stack|postgres/i);
});
