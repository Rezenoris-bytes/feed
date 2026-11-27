import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db";
import { newReference, safeEqual } from "./crypto";
import { HttpError, notFound } from "./rbac";
import { storeAttachment } from "./files";
import { notify, notifyRoles } from "./notify";
import { getSetting } from "./admin";
import { verifyPow } from "./pow";
import { rateLimit } from "./rate-limit";
import { MAX_ATTACHMENTS } from "@/lib/feedback-meta";

/*
 * Fully anonymous submissions. Nothing about the sender is recorded: no user id, no owner tag,
 * no identity mapping, no IP address, no user agent. Even the Super Admin can't reveal who sent it.
 * The sender tracks the case with the reference + a one-time secret key; only an HMAC of the key is stored.
 */

const KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** 20 characters from a 31-symbol alphabet (~99 bits), shown as five groups: 7KQM-X2PA-R9TV-HWC4-N8ZE */
export function newTrackingKey() {
  const b = randomBytes(20);
  const s = Array.from(b, (x) => KEY_ALPHABET[x % KEY_ALPHABET.length]).join("");
  return s.match(/.{4}/g)!.join("-");
}
export const normaliseKey = (k: string) => k.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/(.{4})(?=.)/g, "$1-");

function secret() {
  const k = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("Server misconfigured");
  return k;
}
export const trackingHash = (reference: string, key: string) =>
  createHmac("sha256", secret()).update(`track:${reference}:${normaliseKey(key)}`).digest("base64url");

export async function anonymousSettings() {
  return getSetting("anonymous");
}

export const AnonSubmitInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(150),
  description: z.string().trim().min(20).max(10_000),
  categoryId: z.string().uuid(),
  priorityId: z.string().uuid(),
  departmentId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  accessCode: z.string().max(100).optional().default(""),
  challenge: z.string().max(300),
  counter: z.string().max(20),
});

export async function submitAnonymous(input: z.infer<typeof AnonSubmitInput>, files: File[]) {
  const settings = await anonymousSettings();
  if (settings.accessCode && !safeEqual(input.accessCode.trim().toUpperCase(), settings.accessCode.toUpperCase()))
    throw new HttpError(403, "The access code is not correct");
  if (!verifyPow(input.challenge, input.counter)) throw new HttpError(400, "Security check expired. Please try again.");
  // Global cap (no per-person limit is possible without identifying people).
  if (!rateLimit("anon:submit", settings.hourlyLimit, 60 * 60_000)) throw new HttpError(429, "Too many anonymous submissions right now. Please try again later.");
  if (files.length > MAX_ATTACHMENTS) throw new HttpError(400, `Up to ${MAX_ATTACHMENTS} attachments`);

  const [category, priority] = await Promise.all([
    prisma.feedbackCategory.findFirst({ where: { id: input.categoryId, isActive: true } }),
    prisma.feedbackPriority.findUnique({ where: { id: input.priorityId } }),
  ]);
  if (!category || !priority) throw new HttpError(400, "Choose a valid category and priority");
  if (input.departmentId && !(await prisma.department.findFirst({ where: { id: input.departmentId, isActive: true } })))
    throw new HttpError(400, "Choose a valid department");
  let priorityId = priority.id;
  if (category.sensitive && priority.rank < 3) priorityId = (await prisma.feedbackPriority.findUniqueOrThrow({ where: { key: "HIGH" } })).id;

  const stored: Awaited<ReturnType<typeof storeAttachment>>[] = [];
  for (const f of files) stored.push(await storeAttachment(f));

  const reference = newReference();
  const key = newTrackingKey();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const fb = await prisma.feedbackSubmission.create({
    data: {
      reference, anonymous: true, ownerHmac: null, trackingKeyHash: trackingHash(reference, key),
      title: input.title, description: input.description, categoryId: category.id, priorityId,
      departmentId: input.departmentId ?? null, submittedOn: today,
      attachments: { create: stored.map((s, i) => ({ ...s, label: `Attachment ${i + 1}` })) },
      history: { create: { toStatus: "OPEN", actorId: null } },
    },
  });
  const high = category.sensitive || priority.rank >= 3;
  await notifyRoles(["HR", "SUPER_ADMIN"], high ? "feedback.high" : "feedback.new", `New anonymous ${high ? "high-priority " : ""}feedback ${reference}`, `/hr/cases/${fb.id}`);
  return { reference, key };
}

// ---------- Tracking session (short-lived, scoped to one case) ----------

import { cookieNames } from "./cookie-policy";
const TRACK_TTL_MS = 30 * 60_000;

function sign(body: string) {
  return createHmac("sha256", Buffer.from(process.env.SESSION_SECRET ?? "", "base64")).update("trk:" + body).digest("base64url");
}

/** Checks reference + key; on success sets a 30-minute cookie for this one case only. */
export async function openTracking(reference: string, key: string) {
  const ref = reference.trim().toUpperCase();
  if (!/^FB-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(ref)) throw new HttpError(400, "Check the reference and key");
  // Brute-force protection per reference and overall.
  if (!rateLimit("track:" + ref, 10, 60 * 60_000) || !rateLimit("track:all", 300, 60 * 60_000))
    throw new HttpError(429, "Too many attempts. Try again later.");
  const fb = await prisma.feedbackSubmission.findUnique({ where: { reference: ref }, select: { id: true, anonymous: true, trackingKeyHash: true } });
  const ok = !!fb?.anonymous && !!fb.trackingKeyHash && safeEqual(fb.trackingKeyHash, trackingHash(ref, key));
  if (!ok) throw new HttpError(400, "Check the reference and key"); // same message whether or not the reference exists
  const exp = Date.now() + TRACK_TTL_MS;
  const body = `${fb!.id}.${exp}`;
  const c = await cookieNames("feed_track");
  (await cookies()).set(c.name, `${body}.${sign(body)}`, {
    httpOnly: true, secure: c.secure, sameSite: "strict", path: "/", maxAge: TRACK_TTL_MS / 1000,
  });
  return ref;
}

/** Returns the feedback id the visitor has unlocked, or null. */
export async function trackedFeedbackId(): Promise<string | null> {
  const jar = await cookies();
  const v = (await cookieNames("feed_track")).all.map((n) => jar.get(n)?.value).find(Boolean);
  if (!v) return null;
  const [id, exp, sig] = v.split(".");
  if (!id || !exp || !sig || !safeEqual(sig, sign(`${id}.${exp}`)) || Number(exp) < Date.now()) return null;
  return id;
}

export async function closeTracking() {
  const jar = await cookies();
  for (const n of (await cookieNames("feed_track")).all) jar.delete(n);
}

export async function getTracked(reference: string) {
  const id = await trackedFeedbackId();
  if (!id) return null;
  const fb = await prisma.feedbackSubmission.findFirst({
    where: { id, reference, anonymous: true },
    select: {
      id: true, reference: true, title: true, description: true, status: true, submittedOn: true,
      category: { select: { name: true } }, priority: { select: { name: true } }, department: { select: { name: true } },
      attachments: { select: { id: true, label: true, mimeType: true, sizeBytes: true } },
      history: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      messages: { select: { id: true, author: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return fb;
}

export async function anonymousMessage(reference: string, body: string) {
  const id = await trackedFeedbackId();
  if (!id) throw new HttpError(401, "Your tracking session expired. Enter your reference and key again.");
  const fb = await prisma.feedbackSubmission.findFirst({ where: { id, reference, anonymous: true } });
  if (!fb) throw notFound();
  if (fb.status === "CLOSED") throw new HttpError(400, "This case is closed");
  if (!rateLimit("anonmsg:" + id, 20, 60 * 60_000)) throw new HttpError(429, "Too many messages. Try again later.");
  await prisma.$transaction(async (tx) => {
    await tx.feedbackMessage.create({ data: { feedbackId: fb.id, author: "EMPLOYEE", body } });
    // A reply while the case is on hold puts it back in review.
    if (fb.status === "ON_HOLD")
      await tx.feedbackSubmission.update({ where: { id: fb.id }, data: { status: "IN_REVIEW", history: { create: { fromStatus: "ON_HOLD", toStatus: "IN_REVIEW", actorId: null, remarks: "Sender replied" } } } });
  });
  const assignees = await prisma.feedbackAssignment.findMany({ where: { feedbackId: fb.id, active: true }, select: { assigneeId: true } });
  for (const a of assignees) await notify(a.assigneeId, "feedback.message", `New message on ${fb.reference}`, `/hr/cases/${fb.id}`);
}
