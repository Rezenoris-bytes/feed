import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("@/server/db", () => ({ prisma: {} }));

const { DIFFICULTY, issueChallenge, leadingZeroBits, verifyPow } = await import("@/server/pow");
const { newTrackingKey, normaliseKey, trackingHash } = await import("@/server/anonymous");

function solve(challenge: string) {
  for (let i = 0; ; i++) if (leadingZeroBits(createHash("sha256").update(`${challenge}:${i}`).digest()) >= DIFFICULTY) return String(i);
}

describe("proof-of-work anti-bot check", () => {
  it("accepts a correct solution once (no replay)", () => {
    const { challenge } = issueChallenge();
    const counter = solve(challenge);
    expect(verifyPow(challenge, counter)).toBe(true);
    expect(verifyPow(challenge, counter)).toBe(false);
  });

  it("rejects a wrong counter", () => {
    const { challenge } = issueChallenge();
    let bad = 0;
    while (leadingZeroBits(createHash("sha256").update(`${challenge}:${bad}`).digest()) >= DIFFICULTY) bad++;
    expect(verifyPow(challenge, String(bad))).toBe(false);
  });

  it("rejects forged or expired challenges", () => {
    const { challenge } = issueChallenge();
    const [n, exp, sig] = challenge.split(".");
    const forged = `${n}.${Number(exp) + 999999}.${sig}`;
    expect(verifyPow(forged, solve(forged))).toBe(false);
    const expired = `${n}.${Date.now() - 1}.${sig}`;
    expect(verifyPow(expired, "0")).toBe(false);
    expect(verifyPow("junk", "1")).toBe(false);
    expect(verifyPow(challenge, "not-a-number")).toBe(false);
  });

  it("counts leading zero bits", () => {
    expect(leadingZeroBits(Buffer.from([0, 0, 0x80]))).toBe(16);
    expect(leadingZeroBits(Buffer.from([0, 0x0f]))).toBe(12);
    expect(leadingZeroBits(Buffer.from([0xff]))).toBe(0);
  });
});

describe("anonymous tracking keys", () => {
  it("are 5 groups of 4 from an unambiguous alphabet, and unique", () => {
    const keys = new Set(Array.from({ length: 2000 }, newTrackingKey));
    expect(keys.size).toBe(2000);
    for (const k of keys) expect(k).toMatch(/^([2-9A-HJKMNP-Z]{4}-){4}[2-9A-HJKMNP-Z]{4}$/);
  });

  it("hash ignores case, spaces and dashes typed by the user", () => {
    const k = newTrackingKey();
    const h = trackingHash("FB-AAAA-BBBB-CCCC", k);
    expect(trackingHash("FB-AAAA-BBBB-CCCC", k.toLowerCase().replace(/-/g, " "))).toBe(h);
    expect(normaliseKey(" ab cd-efgh ")).toBe("ABCD-EFGH");
  });

  it("hash is bound to the reference and doesn't contain the key", () => {
    const k = newTrackingKey();
    expect(trackingHash("FB-AAAA-BBBB-CCCC", k)).not.toBe(trackingHash("FB-AAAA-BBBB-DDDD", k));
    expect(trackingHash("FB-AAAA-BBBB-CCCC", k)).not.toContain(k.replace(/-/g, "").slice(0, 6));
  });
});
