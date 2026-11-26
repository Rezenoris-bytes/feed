import { describe, expect, it } from "vitest";
import { decrypt, encrypt, newReference, ownerHmac, safeEqual, sha256 } from "@/server/crypto";

describe("identity encryption", () => {
  it("round-trips", () => {
    const id = "6f1c1f9e-1b4a-4a8a-9d6e-2f7a0c1d2e3f";
    expect(decrypt(encrypt(id)).toString()).toBe(id);
  });

  it("uses a fresh IV every time (same input → different ciphertext)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext", () => {
    const [iv, tag, ct] = encrypt("secret").split(".");
    const flipped = Buffer.from(ct, "base64url"); flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("ciphertext does not contain the plaintext", () => {
    expect(encrypt("employee@example.com")).not.toContain("employee");
  });
});

describe("feedback reference numbers", () => {
  it("match the public format without ambiguous characters", () => {
    for (let i = 0; i < 500; i++) expect(newReference()).toMatch(/^FB-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });

  it("are not sequential or repeated", () => {
    const refs = new Set(Array.from({ length: 5000 }, newReference));
    expect(refs.size).toBe(5000);
  });
});

describe("owner tag", () => {
  it("is stable per user, differs between users, and doesn't contain the user id", () => {
    const a = "11111111-1111-1111-1111-111111111111", b = "22222222-2222-2222-2222-222222222222";
    expect(ownerHmac(a)).toBe(ownerHmac(a));
    expect(ownerHmac(a)).not.toBe(ownerHmac(b));
    expect(ownerHmac(a)).not.toContain("1111");
  });
});

describe("helpers", () => {
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("sha256 is hex", () => expect(sha256("x")).toMatch(/^[0-9a-f]{64}$/));
});
