import { expect, test } from "@playwright/test";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import sharp from "sharp";
import { anon, as } from "./helpers";
import { prisma } from "./fixtures";

test.describe.configure({ mode: "serial" });

// Preserve whatever logo the company already has.
const LOGO = "storage/branding/logo.png", SAVED = "storage/e2e/logo-backup.png";
let savedSetting: unknown = undefined;
test.beforeAll(async () => {
  savedSetting = (await prisma.systemSetting.findUnique({ where: { key: "branding" } }))?.value ?? null;
  if (existsSync(LOGO)) copyFileSync(LOGO, SAVED);
});
test.afterAll(async () => {
  if (existsSync(SAVED)) { copyFileSync(SAVED, LOGO); rmSync(SAVED); } else rmSync(LOGO, { force: true });
  if (savedSetting) await prisma.systemSetting.upsert({ where: { key: "branding" }, update: { value: savedSetting as never }, create: { key: "branding", value: savedSetting as never } });
  else await prisma.systemSetting.deleteMany({ where: { key: "branding" } });
});

const png = () => sharp({ create: { width: 900, height: 300, channels: 4, background: { r: 30, g: 64, b: 175, alpha: 1 } } })
  .png().withExif({ IFD0: { Artist: "Designer Name" } }).toBuffer();

test("Super Admin uploads a logo; it is resized, cleaned and shown everywhere", async () => {
  const sup = await as("super");
  const res = await sup.post("/api/admin/branding", { multipart: { logo: { name: "logo.png", mimeType: "image/png", buffer: await png() } } });
  expect(res.status()).toBe(200);
  const { logoVersion } = await res.json();

  const img = await (await anon()).get(`/api/branding/logo?v=${logoVersion}`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
  const meta = await sharp(await img.body()).metadata();
  expect(meta.width).toBeLessThanOrEqual(512);
  expect(meta.exif).toBeUndefined();

  for (const p of ["/", "/submit", "/login"]) expect(await (await anon()).get(p).then((r) => r.text()), p).toContain(`/api/branding/logo?v=${logoVersion}`);
  expect(await (await as("hr")).get("/hr").then((r) => r.text())).toContain(`/api/branding/logo?v=${logoVersion}`);

  // The installed app (PWA) and the iPhone home-screen icon use the logo too.
  const manifest = await (await anon()).get("/manifest.webmanifest").then((r) => r.json());
  expect(manifest.icons.map((i: { src: string }) => i.src)).toContain(`/api/branding/icon/512?v=${logoVersion}`);
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const s of [32, 180, 192, 512]) {
    const icon = await (await anon()).get(`/api/branding/icon/${s}?v=${logoVersion}`);
    expect(icon.status(), String(s)).toBe(200);
    const m = await sharp(await icon.body()).metadata();
    expect([m.width, m.height]).toEqual([s, s]); // square, exact size
  }
  const head = await (await anon()).get("/").then((r) => r.text());
  expect(head).toMatch(new RegExp(`rel="apple-touch-icon" href="/api/branding/icon/180\\?v=${logoVersion}"`));
  expect((await (await anon()).get("/api/branding/icon/64")).status()).toBe(404);
});

test("only Super Admin can change the logo; SVG and non-images are refused", async () => {
  for (const r of ["hr", "reviewer"] as const) {
    expect((await (await as(r)).post("/api/admin/branding", { multipart: { logo: { name: "x.png", mimeType: "image/png", buffer: await png() } } })).status(), r).toBe(404);
  }
  expect((await (await anon()).post("/api/admin/branding", { multipart: { logo: { name: "x.png", mimeType: "image/png", buffer: await png() } } })).status()).toBe(401);
  const sup = await as("super");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  expect((await sup.post("/api/admin/branding", { multipart: { logo: { name: "x.svg", mimeType: "image/svg+xml", buffer: svg } } })).status()).toBe(400);
  expect((await sup.post("/api/admin/branding", { multipart: { logo: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image") } } })).status()).toBe(400);
});

test("removing the logo falls back to the default mark", async () => {
  const sup = await as("super");
  expect((await sup.delete("/api/admin/branding")).status()).toBe(200);
  expect((await (await anon()).get("/api/branding/logo")).status()).toBe(404);
  expect(await (await anon()).get("/").then((r) => r.text())).not.toContain("/api/branding/logo");
  const manifest = await (await anon()).get("/manifest.webmanifest").then((r) => r.json());
  expect(manifest.icons[0].src).toBe("/icons/icon-192.png");
});
