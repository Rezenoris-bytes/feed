import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./db";
import { staffScope } from "./feedback";
import { getStats, type Range } from "./stats";
import type { AuthContext } from "./session";
import { STATUS_LABEL, type Status } from "@/lib/feedback-meta";
import { csvCell as cell } from "@/lib/csv";

/** Export rows: case metadata only. No description, messages, notes, owner tag or identity. */
export async function reportRows(auth: AuthContext, range: Range) {
  const rows = await prisma.feedbackSubmission.findMany({
    where: { AND: [staffScope(auth), { submittedOn: { gte: range.from, lte: range.to } }] },
    orderBy: { submittedOn: "asc" },
    select: {
      reference: true, title: true, status: true, submittedOn: true, resolvedAt: true, anonymous: true,
      category: { select: { name: true } }, priority: { select: { name: true } }, department: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    Reference: r.reference, Type: r.anonymous ? "Anonymous" : "Confidential", Title: r.title, Category: r.category.name, Priority: r.priority.name,
    Department: r.department?.name ?? "", Status: STATUS_LABEL[r.status as Status],
    Submitted: r.submittedOn.toISOString().slice(0, 10), Resolved: r.resolvedAt?.toISOString().slice(0, 10) ?? "",
  }));
}


export async function toCsv(auth: AuthContext, range: Range) {
  const rows = await reportRows(auth, range);
  const head = ["Reference", "Type", "Title", "Category", "Priority", "Department", "Status", "Submitted", "Resolved"];
  return "﻿" + [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h as keyof typeof r])).join(","))].join("\r\n");
}

export async function toPdf(auth: AuthContext, range: Range, label: string) {
  const [stats, rows] = await Promise.all([getStats(auth, range), reportRows(auth, range)]);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Feedback report"); pdf.setProducer("Feed"); pdf.setCreator("Feed");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const ink = rgb(0.1, 0.12, 0.16), mute = rgb(0.42, 0.45, 0.5), line = rgb(0.85, 0.86, 0.88), navy = rgb(0.12, 0.2, 0.45);
  // Helvetica (WinAnsi) can't encode every character; replace anything outside it.
  const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");
  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(safe(s), { x, y, size, font: f, color });
  const fit = (s: string, w: number, size = 9) => { let t = safe(s); while (t.length > 1 && font.widthOfTextAtSize(t, size) > w) t = t.slice(0, -2) + "…".replace("…", "."); return t; };
  const need = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };

  text("Feedback report", M, 20, bold, navy); y -= 18;
  text(`${label} · generated ${new Date().toISOString().slice(0, 10)} · confidential`, M, 10, font, mute); y -= 28;

  const k = stats.kpis;
  const kpis: [string, string][] = [["Total", String(stats.total)], ["Open", String(k.open)], ["In review", String(k.inReview)],
    ["On hold", String(k.onHold)], ["Resolved", String(k.resolved + k.closed)], ["Avg. time", k.avgResolutionDays === null ? "-" : `${k.avgResolutionDays} d`]];
  kpis.forEach(([l, v], i) => {
    const x = M + (i % 3) * 166, yy = y - Math.floor(i / 3) * 46;
    page.drawRectangle({ x, y: yy - 30, width: 156, height: 40, borderColor: line, borderWidth: 1 });
    page.drawText(l, { x: x + 10, y: yy - 2, size: 8, font, color: mute });
    page.drawText(v, { x: x + 10, y: yy - 22, size: 14, font: bold, color: ink });
  });
  y -= 108;

  const section = (title: string, data: { name: string; value: number }[]) => {
    need(30 + data.length * 15);
    text(title, M, 12, bold); y -= 16;
    const max = Math.max(1, ...data.map((d) => d.value));
    for (const d of data) {
      text(fit(d.name, 150), M, 9);
      page.drawRectangle({ x: M + 160, y: y - 1, width: Math.max(2, (d.value / max) * 280), height: 8, color: navy });
      text(String(d.value), M + 450, 9);
      y -= 15;
    }
    if (!data.length) { text("No data", M, 9, font, mute); y -= 15; }
    y -= 12;
  };
  section("By category", stats.byCategory);
  section("By status", stats.byStatus);
  section("By priority", stats.byPriority);
  section("By department", stats.byDepartment);

  const cols: [keyof (typeof rows)[number], number][] = [["Reference", 92], ["Title", 150], ["Category", 90], ["Status", 80], ["Submitted", 60], ["Resolved", 60]];
  need(40); text("Cases", M, 12, bold); y -= 18;
  const header = () => { let x = M; for (const [c, w] of cols) { text(c, x, 8, bold, mute); x += w; } y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, color: line }); y -= 12; };
  header();
  for (const r of rows) {
    if (y - 14 < M) { page = pdf.addPage([W, H]); y = H - M; header(); }
    let x = M; for (const [c, w] of cols) { text(fit(r[c], w - 6, 8), x, 8); x += w; }
    y -= 13;
  }
  if (!rows.length) text("No cases in this period", M, 9, font, mute);
  return Buffer.from(await pdf.save());
}
