import "server-only";
import { headers } from "next/headers";

/**
 * Cookies are Secure (and use the __Host- prefix) whenever the request came over HTTPS, which is the normal production setup
 * behind Caddy. On plain http (localhost, or a phone on the office Wi-Fi during testing) browsers drop Secure cookies, so we fall
 * back to a non-Secure cookie with the same HttpOnly + SameSite=Strict protections.
 */
export async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

export async function cookieNames(base: string) {
  const secure = await isHttps();
  return { name: secure ? `__Host-${base}` : base, secure, all: [`__Host-${base}`, base] };
}
