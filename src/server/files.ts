import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PDFDocument, PDFName } from "pdf-lib";
import { decrypt, encrypt, fileKey } from "./crypto";
import { HttpError } from "./rbac";
import { storageDir } from "@/lib/storage-dir";
import { ATTACHMENT_TYPES } from "@/lib/feedback-meta";

const DIR = storageDir("uploads", process.env.UPLOAD_DIR);
const MAX = Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;

function sniff(b: Buffer): (typeof ATTACHMENT_TYPES)[number] | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

/** Strips metadata (EXIF/GPS/author), encrypts, stores under a random name. Original filename is discarded. */
export async function storeAttachment(file: File) {
  if (file.size > MAX) throw new HttpError(400, `Each file must be under ${MAX / 1024 / 1024} MB`);
  let buf: Buffer = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf); // trust bytes, not the browser-supplied type or extension
  if (!type) throw new HttpError(400, "Only JPG, PNG, WEBP and PDF files are allowed");

  if (type.startsWith("image/")) {
    // sharp drops all metadata unless withMetadata() is called; rotate() applies EXIF orientation first.
    const img = sharp(buf, { limitInputPixels: 50_000_000 }).rotate();
    buf = type === "image/png" ? await img.png().toBuffer() : type === "image/webp" ? await img.webp().toBuffer() : await img.jpeg({ quality: 90 }).toBuffer();
  } else {
    try {
      const pdf = await PDFDocument.load(buf, { updateMetadata: false });
      pdf.setTitle(""); pdf.setAuthor(""); pdf.setSubject(""); pdf.setKeywords([]);
      pdf.setCreator(""); pdf.setProducer(""); pdf.setCreationDate(new Date(0)); pdf.setModificationDate(new Date(0));
      pdf.catalog.delete(PDFName.of("Metadata")); // XMP stream
      buf = Buffer.from(await pdf.save());
    } catch {
      throw new HttpError(400, "That PDF could not be read. Encrypted or damaged PDFs are not accepted.");
    }
  }

  const storageKey = randomUUID();
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, storageKey + ".bin"), encrypt(buf, fileKey()), { mode: 0o600 });
  return { storageKey, mimeType: type, sizeBytes: buf.length };
}

export async function readAttachment(storageKey: string): Promise<Buffer> {
  if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new HttpError(404, "Not found");
  const enc = await readFile(path.join(DIR, storageKey + ".bin"), "utf8");
  return decrypt(enc, fileKey());
}
