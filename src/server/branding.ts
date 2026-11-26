import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./db";
import { HttpError } from "./rbac";

/*
 * Company logo. Stored locally (no cloud) as a re-encoded PNG, so uploaded files can't carry scripts
 * (SVG is refused) or metadata. The version number busts browser caches when the logo changes.
 */
const DIR = path.resolve(/* turbopackIgnore: true */ process.env.BRANDING_DIR ?? "./storage/branding");
const FILE = path.join(DIR, "logo.png");
const MAX_BYTES = 2 * 1024 * 1024;
/** App-icon sizes generated from the logo: Android (192/512), iPhone home screen (180), browser tab (32). */
export const ICON_SIZES = [32, 180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];
const iconFile = (s: IconSize) => path.join(DIR, `icon-${s}.png`);

/** Logo centred on a white square with a 14% margin each side, so round/squircle masks (maskable icons) never clip it. */
async function makeIcons(png: Buffer) {
  for (const s of ICON_SIZES) {
    const inner = Math.round(s * (s <= 32 ? 0.9 : 0.72));
    const logo = await sharp(png).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    const icon = await sharp({ create: { width: s, height: s, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: logo, gravity: "centre" }]).png().toBuffer();
    await writeFile(iconFile(s), icon);
  }
}

export type Branding = { logoVersion: number | null };

export async function getBranding(): Promise<Branding> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "branding" } });
  const v = (row?.value as { logoVersion?: unknown } | null)?.logoVersion;
  return { logoVersion: typeof v === "number" ? v : null };
}

export const logoUrl = (b: Branding) => (b.logoVersion ? `/api/branding/logo?v=${b.logoVersion}` : null);

function sniff(b: Buffer) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return true; // WEBP
  return false;
}

export async function saveLogo(file: File, actorId: string) {
  if (file.size > MAX_BYTES) throw new HttpError(400, "Logo must be under 2 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniff(buf)) throw new HttpError(400, "Use a PNG, JPG or WEBP image");
  let png: Buffer;
  try {
    // Fit inside 512×512 keeping transparency; strips all metadata.
    png = await sharp(buf, { limitInputPixels: 40_000_000 }).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new HttpError(400, "That image couldn't be read");
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, png);
  await makeIcons(png);
  const value = { logoVersion: Date.now() };
  await prisma.$transaction([
    prisma.systemSetting.upsert({ where: { key: "branding" }, update: { value }, create: { key: "branding", value } }),
    prisma.auditLog.create({ data: { actorId, action: "admin.branding.logo", meta: { bytes: png.length } } }),
  ]);
  return value;
}

export async function removeLogo(actorId: string) {
  await rm(FILE, { force: true });
  for (const s of ICON_SIZES) await rm(iconFile(s), { force: true });
  await prisma.$transaction([
    prisma.systemSetting.deleteMany({ where: { key: "branding" } }),
    prisma.auditLog.create({ data: { actorId, action: "admin.branding.logoRemoved" } }),
  ]);
}

export async function readIcon(size: IconSize): Promise<Buffer | null> {
  const icon = await readFile(iconFile(size)).catch(() => null);
  if (icon) return icon;
  // Icons are derived files: rebuild them from the logo if missing (e.g. after a restore or an older upload).
  const logo = await readLogo();
  if (!logo) return null;
  await makeIcons(logo);
  return readFile(iconFile(size)).catch(() => null);
}

/** Icon URLs for the manifest and <head>: the company's when a logo exists, otherwise the default Feed icons. */
export function appIcons(b: Branding) {
  if (!b.logoVersion) return { i32: "/icons/icon.svg", i180: "/icons/icon-192.png", i192: "/icons/icon-192.png", i512: "/icons/icon-512.png", custom: false };
  const u = (s: IconSize) => `/api/branding/icon/${s}?v=${b.logoVersion}`;
  return { i32: u(32), i180: u(180), i192: u(192), i512: u(512), custom: true };
}

export async function readLogo(): Promise<Buffer | null> {
  return readFile(FILE).catch(() => null);
}
