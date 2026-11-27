import { expect, test } from "@playwright/test";
import { authenticator } from "otplib";
import { anon, as } from "./helpers";
import { accounts, prisma } from "./fixtures";

test.describe.configure({ mode: "serial" });
test.afterAll(async () => { await prisma.systemSetting.deleteMany({ where: { key: "security" } }); }); // back to default: required

test("only a Super Admin can change the rule", async () => {
  for (const r of ["hr", "reviewer"] as const) {
    expect((await (await as(r)).post("/api/admin/security/mfa", { data: { enabled: false, password: "x" } })).status(), r).toBe(404);
  }
  expect((await (await anon()).post("/api/admin/security/mfa", { data: { enabled: false, password: "x" } })).status()).toBe(401);
});

test("turning it off needs the password and a current authenticator code", async () => {
  const sup = await as("super");
  const a = accounts().super;
  expect((await sup.post("/api/admin/security/mfa", { data: { enabled: false, password: "wrong" } })).status()).toBe(400);
  expect((await sup.post("/api/admin/security/mfa", { data: { enabled: false, password: a.password } })).status()).toBe(400); // no code
  expect((await sup.post("/api/admin/security/mfa", { data: { enabled: false, password: a.password, code: "000000" } })).status()).toBe(400);
  const ok = await sup.post("/api/admin/security/mfa", { data: { enabled: false, password: a.password, code: authenticator.generate(a.mfaSecret!) } });
  expect(ok.status()).toBe(200);
  expect(await prisma.auditLog.count({ where: { action: "security.adminMfa.off" } })).toBeGreaterThan(0);
});

test("while off, a Super Admin signs in with only a password", async () => {
  const a = accounts().super;
  const ctx = await anon();
  const r = await ctx.post("/api/auth/login", { data: { email: a.email, password: a.password } });
  expect((await r.json()).next).toBe("/admin");
  expect((await ctx.get("/admin", { maxRedirects: 0 })).status()).toBe(200);
  expect((await ctx.get("/admin/security")).status()).toBe(200);

  // Turning it back on applies to this password-only session immediately.
  const on = await ctx.post("/api/admin/security/mfa", { data: { enabled: true, password: a.password } });
  expect(on.status()).toBe(200);
  expect((await on.json()).next).toBe("/mfa");
  expect((await ctx.get("/admin", { maxRedirects: 0 })).status()).toBe(307);
  expect((await ctx.post("/api/admin/manage", { data: { action: "dept.create", name: "x" } })).status()).toBe(401);
});

test("when on again, sign-in asks for the code", async () => {
  const a = accounts().super;
  const r = await (await anon()).post("/api/auth/login", { data: { email: a.email, password: a.password } });
  expect((await r.json()).next).toBe("/mfa");
});
