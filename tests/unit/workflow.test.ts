import { describe, expect, it } from "vitest";
import { REVIEWER_TARGETS, STATUSES, TRANSITIONS, type Status } from "@/lib/feedback-meta";
import { csvCell } from "@/lib/csv";

describe("feedback workflow", () => {
  it("every status has a transition entry and only valid targets", () => {
    for (const s of STATUSES) {
      expect(TRANSITIONS[s]).toBeDefined();
      for (const t of TRANSITIONS[s]) expect(STATUSES).toContain(t);
      expect(TRANSITIONS[s]).not.toContain(s);
    }
  });

  it("closed, rejected and duplicate are final", () => {
    for (const s of ["CLOSED", "REJECTED", "DUPLICATE"] as Status[]) expect(TRANSITIONS[s]).toEqual([]);
  });

  it("the main path Submitted → Closed is reachable", () => {
    const path: Status[] = ["SUBMITTED", "RECEIVED", "UNDER_REVIEW", "ASSIGNED", "INVESTIGATION", "ACTION_REQUIRED", "RESOLVED", "CLOSED"];
    for (let i = 0; i < path.length - 1; i++) expect(TRANSITIONS[path[i]]).toContain(path[i + 1]);
  });

  it("every status is reachable from Submitted", () => {
    const seen = new Set<Status>(["SUBMITTED"]); const queue: Status[] = ["SUBMITTED"];
    while (queue.length) for (const n of TRANSITIONS[queue.shift()!]) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    expect([...seen].sort()).toEqual([...STATUSES].sort());
  });

  it("reviewers can't reject, escalate, close or mark duplicate", () => {
    for (const s of ["REJECTED", "ESCALATED", "CLOSED", "DUPLICATE"] as Status[]) expect(REVIEWER_TARGETS).not.toContain(s);
  });

});

describe("CSV export escaping", () => {
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx", "\rx"])("neutralises formula %j", (v) => {
    expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("leaves plain text alone", () => expect(csvCell("Broken fan")).toBe("Broken fan"));
});
