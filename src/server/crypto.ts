import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(name: "IDENTITY_ENCRYPTION_KEY" | "FILE_ENCRYPTION_KEY" | "SESSION_SECRET"): Buffer {
  const v = process.env[name];
  if (!v) throw new Error("Server misconfigured"); // never echo key names to clients
  const b = Buffer.from(v, "base64");
  if (b.length !== 32) throw new Error("Server misconfigured");
  return b;
}

/** AES-256-GCM → "iv.tag.ciphertext" (base64url). */
export function encrypt(plain: string | Buffer, k: Buffer = key("IDENTITY_ENCRYPTION_KEY")): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string, k: Buffer = key("IDENTITY_ENCRYPTION_KEY")): Buffer {
  const [iv, tag, ct] = token.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export const fileKey = () => key("FILE_ENCRYPTION_KEY");

/** Non-reversible owner tag so employees can list their own feedback without a user FK. */
export function ownerHmac(userId: string): string {
  return createHmac("sha256", key("IDENTITY_ENCRYPTION_KEY")).update("owner:" + userId).digest("base64url");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L
/** e.g. FB-7K3Q-9XMD-P2WA — 60 bits from CSPRNG, not sequential. */
export function newReference(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `FB-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
