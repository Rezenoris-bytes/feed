import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decrypt, encrypt, randomToken, sha256 } from "./crypto";
import { HttpError, notFound } from "./rbac";
import type { AuthContext } from "./session";
import { getSetting } from "./admin";
import { mailConfigured, sendFormEmail } from "./mail";
import { AboutInput, Field, FormInput, SendInput, checkAnswers, inviteMessage, whoLabel, type CustomerField } from "@/lib/customer-forms";

const audit = (auth: AuthContext, action: string, target: string, meta?: Prisma.InputJsonValue) =>
  prisma.auditLog.create({ data: { actorId: auth.userId, action: "customers." + action, target, meta } });

export const fieldsOf = (v: unknown): CustomerField[] => {
  const p = z.array(Field).safeParse(v);
  return p.success ? p.data : [];
};

/** Base URL for links. APP_URL wins (set it on Hostinger); otherwise the request's own host. */
export function baseUrl(req: Request) {
  return baseUrlFrom(req.headers, req.url);
}
export function baseUrlFrom(h: Headers, url = "http://localhost") {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? new URL(url).protocol.replace(":", "");
  return `${proto}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

// ── Forms ─────────────────────────────────────────────────────────────────────
export async function createForm(auth: AuthContext, input: unknown) {
  const d = FormInput.parse(input);
  const f = await prisma.customerForm.create({ data: { ...d, fields: d.fields, createdById: auth.userId } });
  await audit(auth, "form.create", f.id, { title: d.title });
  return f;
}

export async function updateForm(auth: AuthContext, id: string, input: unknown) {
  const body = z.object({ status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(), share: z.boolean().optional() }).passthrough().parse(input);
  const existing = await prisma.customerForm.findUnique({ where: { id } });
  if (!existing) throw notFound();
  const data: Prisma.CustomerFormUpdateInput = {};
  if ("fields" in body) { const d = FormInput.parse(body); Object.assign(data, { ...d, fields: d.fields }); }
  if (body.status) data.status = body.status;
  if (body.share !== undefined) data.shareCode = body.share ? (existing.shareCode ?? randomToken(12)) : null; // off → old link dies
  const f = await prisma.customerForm.update({ where: { id }, data });
  await audit(auth, body.share !== undefined ? "form.share" : body.status ? "form.status" : "form.update", id,
    body.share !== undefined ? { on: body.share } : body.status ? { status: body.status } : undefined);
  return f;
}

export async function deleteForm(auth: AuthContext, id: string) {
  const f = await prisma.customerForm.findUnique({ where: { id }, include: { _count: { select: { sends: true } } } });
  if (!f) throw notFound();
  // Forms that were sent keep their history: archive them instead.
  if (f._count.sends > 0) throw new HttpError(409, "This form has been sent. Archive it instead.");
  await prisma.customerForm.delete({ where: { id } });
  await audit(auth, "form.delete", id, { title: f.title });
}

// ── Sending ───────────────────────────────────────────────────────────────────
export async function createSend(auth: AuthContext, formId: string, input: unknown, req: Request) {
  const d = SendInput.parse(input);
  const form = await prisma.customerForm.findUnique({ where: { id: formId } });
  if (!form) throw notFound();
  if (form.status !== "ACTIVE") throw new HttpError(409, "Publish the form before sending it.");
  if (d.sendEmail && !d.email) throw new HttpError(400, "Add the customer's email to send by email.");
  if (d.sendEmail && !mailConfigured()) throw new HttpError(409, "Email isn't set up on the server yet. Use WhatsApp or copy the link.");

  const token = randomToken(24);
  const send = await prisma.customerFormSend.create({
    data: {
      formId, tokenHash: sha256(token), tokenEnc: encrypt(token),
      customerName: d.customerName, company: d.company, email: d.email, phone: d.phone, machine: d.machine,
      sentById: auth.userId, expiresAt: new Date(Date.now() + d.days * 86_400_000),
    },
  });
  const link = `${baseUrl(req)}/f/${token}`;
  const company = (await getSetting("company")).name;
  const message = inviteMessage({ customerName: d.customerName, company, formTitle: form.title, machine: d.machine });

  let emailed = false;
  if (d.sendEmail && d.email) {
    try {
      await sendFormEmail({ to: d.email, company, customerName: d.customerName, formTitle: form.title, link, message });
      await prisma.customerFormSend.update({ where: { id: send.id }, data: { emailedAt: new Date() } });
      emailed = true;
    } catch (e) {
      console.error("[mail]", e instanceof Error ? e.message : "send failed");
    }
  }
  await audit(auth, "send.create", send.id, { formId, emailed });
  return { id: send.id, link, message, emailed, emailFailed: d.sendEmail && !emailed };
}

/** Lets staff copy / WhatsApp a link again later. */
export async function sendLink(id: string, req: Request) {
  const s = await prisma.customerFormSend.findUnique({ where: { id }, include: { form: { select: { title: true } } } });
  if (!s) throw notFound();
  const link = `${baseUrl(req)}/f/${decrypt(s.tokenEnc).toString()}`;
  const company = (await getSetting("company")).name;
  return { link, message: inviteMessage({ customerName: s.customerName, company, formTitle: s.form.title, machine: s.machine }), phone: s.phone };
}

export async function emailSendAgain(auth: AuthContext, id: string, req: Request) {
  if (!mailConfigured()) throw new HttpError(409, "Email isn't set up on the server yet.");
  const s = await prisma.customerFormSend.findUnique({ where: { id }, include: { form: { select: { title: true } } } });
  if (!s) throw notFound();
  if (!s.email) throw new HttpError(400, "This customer has no email address.");
  if (s.respondedAt || s.revokedAt || s.expiresAt < new Date()) throw new HttpError(409, "This link is no longer open.");
  const { link, message } = await sendLink(id, req);
  const company = (await getSetting("company")).name;
  try {
    await sendFormEmail({ to: s.email, company, customerName: s.customerName, formTitle: s.form.title, link, message });
  } catch (e) {
    console.error("[mail]", e instanceof Error ? e.message : "send failed");
    throw new HttpError(502, "The email could not be sent. Check the SMTP settings.");
  }
  await prisma.customerFormSend.update({ where: { id }, data: { emailedAt: new Date() } });
  await audit(auth, "send.email", id);
}

export async function revokeSend(auth: AuthContext, id: string) {
  const s = await prisma.customerFormSend.findUnique({ where: { id } });
  if (!s) throw notFound();
  if (s.respondedAt) throw new HttpError(409, "The customer has already replied.");
  await prisma.customerFormSend.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(auth, "send.revoke", id);
}

// ── Public (customer) side ────────────────────────────────────────────────────
type Open = { state: "open"; send: { id: string; customerName: string; machine: string | null }; form: { title: string; intro: string; thanks: string; fields: CustomerField[] } };
type Closed = { state: "replied" | "expired" | "withdrawn" | "unavailable"; thanks?: string };

/** Looks a link up by its token. Unknown tokens and broken forms both read as "unavailable". */
export async function openLink(token: string, markOpened = false): Promise<Open | Closed | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const s = await prisma.customerFormSend.findUnique({ where: { tokenHash: sha256(token) }, include: { form: true } });
  if (!s) return null;
  if (s.respondedAt) return { state: "replied", thanks: s.form.thanks };
  if (s.revokedAt) return { state: "withdrawn" };
  if (s.expiresAt < new Date()) return { state: "expired" };
  if (s.form.status !== "ACTIVE") return { state: "unavailable" };
  if (markOpened && !s.openedAt) await prisma.customerFormSend.update({ where: { id: s.id }, data: { openedAt: new Date() } });
  return {
    state: "open",
    send: { id: s.id, customerName: s.customerName, machine: s.machine },
    form: { title: s.form.title, intro: s.form.intro, thanks: s.form.thanks, fields: fieldsOf(s.form.fields) },
  };
}

export async function submitAnswers(token: string, raw: unknown) {
  const link = await openLink(token);
  if (!link) throw notFound();
  if (link.state !== "open") throw new HttpError(409, link.state === "replied" ? "You have already answered this form. Thank you!" : "This link is no longer open.");
  const parsed = checkAnswers(link.form.fields, z.record(z.string(), z.unknown()).parse(raw));
  if (!parsed.ok) return parsed;
  try {
    await prisma.$transaction([
      // respondedAt: null in the where clause makes two quick submits race-safe: only one can win.
      prisma.customerFormSend.update({ where: { id: link.send.id, respondedAt: null }, data: { respondedAt: new Date() } }),
      prisma.customerFormResponse.create({ data: { sendId: link.send.id, fields: link.form.fields, answers: parsed.answers } }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2025", "P2002"].includes(e.code)) throw new HttpError(409, "You have already answered this form. Thank you!");
    throw e;
  }
  await notifyStaff(link.send.id, link.send.customerName || "A customer", link.form.title);
  return { ok: true as const, thanks: link.form.thanks };
}

async function notifyStaff(sendId: string, customer: string, formTitle: string) {
  const s = await prisma.customerFormSend.findUnique({ where: { id: sendId }, select: { formId: true } });
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null, roles: { some: { role: { key: { in: ["HR", "SUPER_ADMIN"] } } } } },
    select: { id: true, roles: { select: { role: { select: { key: true } } } } },
  });
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id, kind: "customer.response", text: `${customer} answered "${formTitle}"`.slice(0, 190),
      link: `${u.roles.some((r) => r.role.key === "SUPER_ADMIN") ? "/admin" : "/hr"}/customers/${s?.formId}?tab=responses`,
    })),
  });
}

// ── Open link (one link for everyone; details optional) ───────────────────────
export async function openShare(code: string) {
  if (!/^[A-Za-z0-9_-]{12,32}$/.test(code)) return null;
  const form = await prisma.customerForm.findUnique({ where: { shareCode: code } });
  if (!form) return null;
  if (form.status !== "ACTIVE") return { state: "unavailable" as const };
  return { state: "open" as const, form: { id: form.id, title: form.title, intro: form.intro, thanks: form.thanks, fields: fieldsOf(form.fields) } };
}

export async function submitShare(code: string, raw: unknown) {
  const body = z.object({ answers: z.record(z.string(), z.unknown()), about: AboutInput, website: z.string().optional() }).parse(raw);
  const link = await openShare(code);
  if (!link) throw notFound();
  if (link.state !== "open") throw new HttpError(409, "This form isn't available right now.");
  if (body.website) return { ok: true as const, thanks: link.form.thanks }; // bot filled the hidden field: pretend success, store nothing
  const parsed = checkAnswers(link.form.fields, body.answers);
  if (!parsed.ok) return parsed;
  const a = body.about;
  const t = randomToken(24); // never shown: open-link replies have no personal link
  const now = new Date();
  const send = await prisma.customerFormSend.create({
    data: {
      formId: link.form.id, viaShare: true, tokenHash: sha256(t), tokenEnc: encrypt(t),
      customerName: a.name ?? "", company: a.company || null, phone: a.phone ?? null, email: a.email ?? null, machine: a.machine || null,
      openedAt: now, respondedAt: now, expiresAt: now,
      response: { create: { fields: link.form.fields, answers: parsed.answers } },
    },
  });
  await notifyStaff(send.id, whoLabel({ ...send, viaShare: true }), link.form.title);
  return { ok: true as const, thanks: link.form.thanks };
}

// ── Reading (staff) ───────────────────────────────────────────────────────────
export async function listForms() {
  const forms = await prisma.customerForm.findMany({
    where: { status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sends: { where: { viaShare: false } } } } }, // personal links sent
  });
  const replied = await prisma.customerFormSend.groupBy({ by: ["formId"], where: { respondedAt: { not: null } }, _count: true });
  const archived = await prisma.customerForm.count({ where: { status: "ARCHIVED" } });
  return { forms: forms.map((f) => ({ ...f, sent: f._count.sends, replied: replied.find((r) => r.formId === f.id)?._count ?? 0 })), archived };
}

export async function getFormDetail(id: string) {
  const form = await prisma.customerForm.findUnique({
    where: { id },
    include: { sends: { orderBy: { createdAt: "desc" }, take: 500, include: { response: true } } },
  });
  if (!form) return null;
  const senders = await prisma.user.findMany({ where: { id: { in: [...new Set(form.sends.map((s) => s.sentById).filter(Boolean) as string[])] } }, select: { id: true, displayName: true } });
  return {
    ...form, fields: fieldsOf(form.fields),
    sends: form.sends.map(({ tokenEnc: _t, tokenHash: _h, ...s }) => ({
      ...s, sentBy: senders.find((u) => u.id === s.sentById)?.displayName ?? null,
      response: s.response ? { submittedAt: s.response.submittedAt, fields: fieldsOf(s.response.fields), answers: s.response.answers as Record<string, string | number | string[]> } : null,
    })),
  };
}
export type FormDetail = NonNullable<Awaited<ReturnType<typeof getFormDetail>>>;
