import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import "dotenv/config";

export const BACKUP_DIR = process.env.BACKUP_DIR ?? "./storage/backups";

// Backups use their own key so a stolen backup is useless without it. Falls back to FILE_ENCRYPTION_KEY.
function key() {
  const k = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || process.env.FILE_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY (or FILE_ENCRYPTION_KEY) must be a 32-byte base64 key");
  return k;
}

/** gzip → AES-256-GCM. Layout: 12-byte IV | 16-byte tag | ciphertext. */
export function seal(data: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(gzipSync(data)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

export function open(blob: Buffer) {
  const d = createDecipheriv("aes-256-gcm", key(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return gunzipSync(Buffer.concat([d.update(blob.subarray(28)), d.final()]));
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export type Manifest = {
  version: 1;
  createdAt: string;
  migrations: string[];
  tables: { name: string; rows: number; sha256: string }[];
  uploads: { name: string; sha256: string }[];
};
