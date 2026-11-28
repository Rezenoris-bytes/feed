// Where uploaded files (attachments, company logo) and backups live. Shared by the app and the scripts.
import os from "node:os";
import path from "node:path";

/**
 * STORAGE_DIR if set. Otherwise, on Hostinger, a folder in the account's home directory: Hostinger builds every
 * deploy into a fresh .../hbuilds/versions/<id>/ folder, so anything saved inside the app folder disappears on the
 * next deploy. Locally: ./storage.
 */
export function storageRoot() {
  if (process.env.STORAGE_DIR) return path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR);
  if (/[\/]hbuilds[\/]versions[\/]/.test(process.cwd())) return path.join(os.homedir(), "feed-storage");
  return path.resolve(/* turbopackIgnore: true */ "storage");
}

/** A sub-folder of the storage root, unless its own env var (e.g. UPLOAD_DIR) points somewhere else. */
export function storageDir(sub: "uploads" | "branding" | "backups", override?: string) {
  return override ? path.resolve(/* turbopackIgnore: true */ override) : path.join(storageRoot(), sub);
}
