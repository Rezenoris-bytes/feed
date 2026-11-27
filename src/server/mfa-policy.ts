import "server-only";
import { getSetting } from "./admin";

/**
 * Whether Super Admins must enter an authenticator code. On by default; a Super Admin can turn it off
 * (password + current code required, audited). If the setting can't be read, it fails safe: required.
 */
export async function adminMfaRequired(): Promise<boolean> {
  try {
    return (await getSetting("security")).requireAdminMfa !== false;
  } catch {
    return true;
  }
}