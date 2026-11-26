import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { request } from "@playwright/test";
import { BASE } from "../../playwright.config";
import { E2E_DOMAIN, encryptForApp, prisma, ROLES, STATE_DIR, statePath, TEST_ANON_SETTINGS, type Accounts } from "./fixtures";
import teardown from "./global-teardown";

/** Creates throwaway staff accounts (never the seeded ones), logs each in once and saves the session for the tests. */
export default async function globalSetup() {
  await teardown(); // clear leftovers from an interrupted run
  mkdirSync(STATE_DIR, { recursive: true });

  // Remember the real anonymous settings so teardown can restore them.
  const prev = await prisma.systemSetting.findUnique({ where: { key: "anonymous" } });
  writeFileSync(`${STATE_DIR}/anon-settings.json`, JSON.stringify(prev?.value ?? null));
  await prisma.systemSetting.upsert({ where: { key: "anonymous" }, update: { value: TEST_ANON_SETTINGS }, create: { key: "anonymous", value: TEST_ANON_SETTINGS } });

  const ops = await prisma.department.findUniqueOrThrow({ where: { name: "Operations" } });
  const sales = await prisma.department.findUniqueOrThrow({ where: { name: "Sales" } });
  const roleId = async (key: "SUPER_ADMIN" | "HR" | "REVIEWER" | "EMPLOYEE") => (await prisma.role.findUniqueOrThrow({ where: { key } })).id;
  const spec: Record<keyof Accounts, { key: "SUPER_ADMIN" | "HR" | "REVIEWER" | "EMPLOYEE"; name: string; dept?: string }> = {
    super: { key: "SUPER_ADMIN", name: "E2E Super Admin" },
    hr: { key: "HR", name: "E2E HR Person" },
    reviewer: { key: "REVIEWER", name: "E2E Ops Reviewer", dept: ops.id },
    otherReviewer: { key: "REVIEWER", name: "E2E Sales Reviewer", dept: sales.id },
    // An old-style employee account: must NOT be able to sign in.
    legacyEmployee: { key: "EMPLOYEE", name: "E2E Legacy Employee", dept: ops.id },
  };

  // Unique per run so the server's in-memory login rate limit never trips on repeated runs.
  const runId = Date.now().toString(36);
  const accounts = {} as Accounts;
  for (const r of Object.keys(spec) as (keyof Accounts)[]) {
    const s = spec[r];
    const password = randomBytes(12).toString("base64url");
    const mfaSecret = s.key === "SUPER_ADMIN" ? authenticator.generateSecret() : undefined;
    const email = `${r.toLowerCase()}-${runId}@${E2E_DOMAIN}`;
    await prisma.user.create({
      data: {
        email, displayName: s.name, passwordHash: await bcrypt.hash(password, 10), departmentId: s.dept ?? null,
        mfaEnabled: !!mfaSecret, mfaSecretEnc: mfaSecret ? encryptForApp(mfaSecret) : null,
        roles: { create: { roleId: await roleId(s.key) } },
      },
    });
    accounts[r] = { email, password, name: s.name, mfaSecret };
  }
  writeFileSync(`${STATE_DIR}/accounts.json`, JSON.stringify(accounts));

  for (const r of ROLES) {
    const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
    const res = await ctx.post("/api/auth/login", { data: { email: accounts[r].email, password: accounts[r].password } });
    if (!res.ok()) throw new Error(`E2E login failed for ${r}: ${res.status()}`);
    if (accounts[r].mfaSecret) {
      const m = await ctx.post("/api/auth/mfa", { data: { code: authenticator.generate(accounts[r].mfaSecret!) } });
      if (!m.ok()) throw new Error("E2E MFA failed");
    }
    await ctx.storageState({ path: statePath(r) });
    await ctx.dispose();
  }
  await prisma.$disconnect();
}
