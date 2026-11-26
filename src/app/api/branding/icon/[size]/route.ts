import { ICON_SIZES, readIcon, type IconSize } from "@/server/branding";

/** Public app icons generated from the company logo (used by the manifest and the home-screen icon). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size) as IconSize;
  if (!ICON_SIZES.includes(size)) return new Response("Not found", { status: 404 });
  const png = await readIcon(size);
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}