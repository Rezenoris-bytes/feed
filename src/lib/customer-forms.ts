// Shared by the builder (client), the API and the public customer page.
import { z } from "zod";

export const FIELD_TYPES = ["short", "long", "rating", "yesno", "choice", "multi"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const FIELD_LABEL: Record<FieldType, string> = {
  short: "Short answer", long: "Paragraph", rating: "Star rating", yesno: "Yes / No", choice: "One choice", multi: "Checkboxes",
};

const Option = z.string().trim().min(1).max(80);
export const Field = z.object({
  id: z.string().regex(/^[a-z0-9]{6,16}$/),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1, "Every question needs text").max(200),
  help: z.string().trim().max(200).default(""),
  required: z.boolean().default(false),
  options: z.array(Option).max(15).default([]),
}).superRefine((f, ctx) => {
  if ((f.type === "choice" || f.type === "multi") && f.options.length < 2)
    ctx.addIssue({ code: "custom", path: ["options"], message: `"${f.label}" needs at least two options` });
});
export type CustomerField = z.infer<typeof Field>;

export const FormInput = z.object({
  title: z.string().trim().min(2, "Give the form a title").max(120),
  intro: z.string().trim().max(600).default(""),
  thanks: z.string().trim().max(300).default(""),
  fields: z.array(Field).min(1, "Add at least one question").max(40),
});

export const SendInput = z.object({
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  company: z.string().trim().max(120).optional().transform((v) => v || undefined),
  email: z.string().trim().toLowerCase().max(254).optional().transform((v) => v || undefined).pipe(z.string().email("Check the email address").optional()),
  phone: z.string().trim().max(32).optional().transform((v) => v || undefined)
    .pipe(z.string().regex(/^\+?[0-9 ()-]{7,24}$/, "Check the phone number").optional()),
  machine: z.string().trim().max(160).optional().transform((v) => v || undefined),
  days: z.number().int().min(1).max(180).default(30),
  sendEmail: z.boolean().default(false),
});

export const newFieldId = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");

/** Checks a customer's answers against the questions; returns clean answers or a message. */
export function checkAnswers(fields: CustomerField[], raw: Record<string, unknown>):
  { ok: true; answers: Record<string, string | number | string[]> } | { ok: false; error: string; field?: string } {
  const out: Record<string, string | number | string[]> = {};
  for (const f of fields) {
    const v = raw[f.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required) return { ok: false, error: `Please answer "${f.label}"`, field: f.id };
      continue;
    }
    switch (f.type) {
      case "short": case "long": {
        if (typeof v !== "string") return { ok: false, error: "Invalid answer", field: f.id };
        const t = v.trim().slice(0, f.type === "short" ? 300 : 5000);
        if (t) out[f.id] = t; else if (f.required) return { ok: false, error: `Please answer "${f.label}"`, field: f.id };
        break;
      }
      case "rating": {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: "Invalid rating", field: f.id };
        out[f.id] = n; break;
      }
      case "yesno":
        if (v !== "Yes" && v !== "No") return { ok: false, error: "Invalid answer", field: f.id };
        out[f.id] = v; break;
      case "choice":
        if (typeof v !== "string" || !f.options.includes(v)) return { ok: false, error: "Invalid choice", field: f.id };
        out[f.id] = v; break;
      case "multi": {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !f.options.includes(x))) return { ok: false, error: "Invalid choice", field: f.id };
        out[f.id] = [...new Set(v as string[])]; break;
      }
    }
  }
  return { ok: true, answers: out };
}

const q = (type: FieldType, label: string, extra: Partial<CustomerField> = {}): CustomerField =>
  ({ id: newFieldId(), type, label, help: "", required: false, options: [], ...extra });

/** Ready-made starting points. Every question can be edited afterwards. */
export const TEMPLATES: { key: string; title: string; summary: string; build: () => z.input<typeof FormInput> }[] = [
  {
    key: "machine", title: "Machine feedback", summary: "Performance, reliability and service for a machine",
    build: () => ({
      title: "Machine feedback",
      intro: "Tell us how your machine is working for you. It takes about two minutes.",
      thanks: "Thank you. Our service team will review your feedback.",
      fields: [
        q("rating", "Overall, how happy are you with the machine?", { required: true }),
        q("rating", "How reliable has it been?"),
        q("choice", "How often do you use it?", { options: ["Every day", "A few times a week", "Occasionally", "Rarely"] }),
        q("yesno", "Have you had any breakdowns in the last 3 months?"),
        q("long", "What problems, if any, have you faced?"),
        q("rating", "How would you rate our service and support?"),
        q("yesno", "Would you recommend us to others?"),
        q("long", "Anything else we should know?"),
      ],
    }),
  },
  {
    key: "cancel", title: "Service cancellation", summary: "Why a customer is leaving, and what could change their mind",
    build: () => ({
      title: "We're sorry to see you go",
      intro: "Please tell us why you're cancelling so we can improve. It takes about a minute.",
      thanks: "Thank you for your honest feedback. We may contact you to see if we can help.",
      fields: [
        q("choice", "Main reason for cancelling", { required: true, options: ["Price too high", "Machine problems", "Slow or poor service", "Switching to another supplier", "No longer need the service", "Other"] }),
        q("multi", "What else played a part?", { options: ["Breakdowns", "Spare parts delays", "Response time", "Billing issues", "Communication"] }),
        q("long", "Please tell us more"),
        q("rating", "How would you rate your overall experience with us?"),
        q("yesno", "Would anything change your mind?"),
        q("short", "If yes, what would help?"),
        q("yesno", "May we call you to discuss this?"),
      ],
    }),
  },
  {
    key: "blank", title: "Blank form", summary: "Start from scratch",
    build: () => ({ title: "Customer feedback", intro: "", thanks: "", fields: [q("long", "Your feedback", { required: true })] }),
  },
];

export const SEND_STATE = (s: { respondedAt: Date | string | null; revokedAt: Date | string | null; expiresAt: Date | string; openedAt: Date | string | null }) =>
  s.respondedAt ? "replied" : s.revokedAt ? "withdrawn" : new Date(s.expiresAt) < new Date() ? "expired" : s.openedAt ? "opened" : "sent";
export type SendState = ReturnType<typeof SEND_STATE>;

/** The invitation text used for WhatsApp and email (the link is added at the end). */
export function inviteMessage(o: { customerName: string; company: string; formTitle: string; machine?: string | null }) {
  const about = o.machine ? ` about ${o.machine}` : "";
  return `Hi ${o.customerName}, this is ${o.company}. We'd value your feedback${about}. Please fill in our short form "${o.formTitle}" – it takes about two minutes.`;
}

/** wa.me click-to-chat link: opens WhatsApp with the message ready; staff tap send. Free, no API. */
export function whatsappUrl(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
