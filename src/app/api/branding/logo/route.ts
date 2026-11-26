import { readLogo } from "@/server/branding";

/** Public: the logo appears on the no-login employee pages too. */
export async function GET() {
  const png = await readLogo();
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // URLs carry ?v=<version>, so a long cache is safe; a new upload gets a new URL.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
