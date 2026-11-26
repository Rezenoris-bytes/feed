import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

export const STATE_DIR = "storage/e2e";
/** Staff roles that sign in. Employees never sign in (all submissions are anonymous). */
export const ROLES = ["super", "hr", "reviewer", "otherReviewer"] as const;
export type E2ERole = (typeof ROLES)[number];
export type Account = { email: string; password: string; name: string; mfaSecret?: string };
export type Accounts = Record<E2ERole | "legacyEmployee", Account>;

export const accounts = (): Accounts => JSON.parse(readFileSync(`${STATE_DIR}/accounts.json`, "utf8"));
export const statePath = (r: E2ERole) => `${STATE_DIR}/${r}.json`;
export const prisma = new PrismaClient();

/** Same format as src/server/crypto.ts encrypt() (that module is server-only). */
export function encryptForApp(plain: string) {
  const k = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY!, "base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export const E2E_DOMAIN = "e2e.feed.test";
export const E2E_TAG = "[e2e]";
/** Anonymous-submission settings used while tests run (no access code, high hourly cap). */
export const TEST_ANON_SETTINGS = { accessCode: "", hourlyLimit: 1000 };
