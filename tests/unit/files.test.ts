import { afterAll, describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { readAttachment, storeAttachment } from "@/server/files";

const DIR = path.resolve("./storage/test-uploads");
afterAll(() => rm(DIR, { recursive: true, force: true }));

const file = (data: Buffer | string, name: string, type: string) => new File([new Uint8Array(Buffer.from(data))], name, { type });

describe("attachment handling", () => {
  it("strips EXIF (author, GPS) from photos", async () => {
    const jpg = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#00f" } })
      .jpeg().withExif({ IFD0: { Artist: "Jane Employee", Copyright: "x" } }).toBuffer();
    expect((await sharp(jpg).metadata()).exif).toBeDefined();
    const s = await storeAttachment(file(jpg, "IMG_jane.jpg", "image/jpeg"));
    const out = await readAttachment(s.storageKey);
    expect((await sharp(out).metadata()).exif).toBeUndefined();
    expect(out.toString("latin1")).not.toContain("Jane");
  });

  it("strips PDF author/title metadata", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.setAuthor("Jane Employee"); pdf.setTitle("My complaint by Jane");
    const s = await storeAttachment(file(Buffer.from(await pdf.save()), "jane.pdf", "application/pdf"));
    const out = await PDFDocument.load(await readAttachment(s.storageKey));
    expect(out.getAuthor() ?? "").toBe("");
    expect(out.getTitle() ?? "").toBe("");
  });

  it("encrypts at rest under a random name; original filename is never stored", async () => {
    const png = await sharp({ create: { width: 5, height: 5, channels: 3, background: "#0f0" } }).png().toBuffer();
    const s = await storeAttachment(file(png, "jane-smith-evidence.png", "image/png"));
    expect(s.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    const onDisk = await readFile(path.join(DIR, s.storageKey + ".bin"), "utf8");
    expect(onDisk).not.toContain("PNG");
    expect(JSON.stringify(s)).not.toContain("jane");
  });

  it("rejects files whose bytes don't match an allowed type, whatever the name or MIME says", async () => {
    await expect(storeAttachment(file("<script>alert(1)</script>", "x.png", "image/png"))).rejects.toThrow(/Only JPG/);
    await expect(storeAttachment(file("MZ\x90\x00", "x.pdf", "application/pdf"))).rejects.toThrow(/Only JPG/);
  });

  it("rejects oversized files", async () => {
    await expect(storeAttachment(file(Buffer.alloc(2 * 1024 * 1024), "big.jpg", "image/jpeg"))).rejects.toThrow(/under/);
  });

  it("refuses path traversal in storage keys", async () => {
    await expect(readAttachment("../../.env")).rejects.toThrow();
  });
});
