import "server-only";
import nodemailer from "nodemailer";

// Email goes out through your own mailbox over SMTP (e.g. Hostinger email: smtp.hostinger.com, port 465).
// Free; nothing leaves except the message itself. Not configured = the app offers WhatsApp / copy link instead.
export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: nodemailer.Transporter | null = null;
function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000,
    });
  }
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendFormEmail(o: { to: string; company: string; customerName: string; formTitle: string; link: string; message: string }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <p style="font-size:15px;line-height:1.6;white-space:pre-line">${esc(o.message)}</p>
  <p style="margin:28px 0"><a href="${esc(o.link)}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">Open the form</a></p>
  <p style="font-size:12px;color:#64748b">This link is personal to you and works once. ${esc(o.company)}</p></div>`;
  await getTransport().sendMail({
    from: `"${o.company.replace(/"/g, "")}" <${from}>`, to: o.to,
    subject: `${o.formTitle} – ${o.company}`,
    text: `${o.message}\n\n${o.link}`, html,
  });
}
