/** CSV cell: neutralises spreadsheet formula injection (=, +, -, @, tab, CR) and quotes when needed. */
export function csvCell(v: string): string {
  const s = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
