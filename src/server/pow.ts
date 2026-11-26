import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "./crypto";

/**
 * Proof-of-work anti-bot check. Runs entirely on this server and the visitor's browser:
 * no third-party CAPTCHA, no IP address, no fingerprinting.
 * The browser must find a counter so that sha256(challenge + ":" + counter) starts with DIFFICULTY zero bits
 * (~65k hashes, about a second on a phone). Cheap for one person, expensive for a spam script.
 */
export const DIFFICULTY = 16;
const TTL_MS = 10 * 60_000;
const used = new Map<string, number>(); // challenge → expiry, prevents replay

function key() {
  return Buffer.from(process.env.SESSION_SECRET ?? "", "base64");
}

export function issueChallenge() {
  const nonce = randomBytes(16).toString("base64url");
  const exp = Date.now() + TTL_MS;
  const body = `${nonce}.${exp}`;
  const sig = createHmac("sha256", key()).update("pow:" + body).digest("base64url");
  return { challenge: `${body}.${sig}`, difficulty: DIFFICULTY };
}

export function leadingZeroBits(buf: Buffer) {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) { bits += 8; continue; }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

export function verifyPow(challenge: unknown, counter: unknown): boolean {
  if (typeof challenge !== "string" || typeof counter !== "string" || !/^\d{1,12}$/.test(counter)) return false;
  const [nonce, expStr, sig] = challenge.split(".");
  if (!nonce || !expStr || !sig) return false;
  const expected = createHmac("sha256", key()).update(`pow:${nonce}.${expStr}`).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  const exp = Number(expStr);
  if (!(exp > Date.now())) return false;
  if (used.has(challenge)) return false;
  const h = createHash("sha256").update(`${challenge}:${counter}`).digest();
  if (leadingZeroBits(h) < DIFFICULTY) return false;
  used.set(challenge, exp);
  for (const [c, e] of used) if (e < Date.now()) used.delete(c);
  return true;
}
