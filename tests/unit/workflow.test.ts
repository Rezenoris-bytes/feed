import { describe, expect, it } from "vitest";
import { REVIEWER_TARGETS, STAGES, STATUSES, TRANSITIONS, stageIndex, type Status } from "@/lib/feedback-meta";
import { csvCell } from "@/lib/csv";

describe("feedback workflow", () => {
  it("every status has a transition entry and only valid targets", () => {
    for (const s of STATUSES) {
      expect(TRANSITIONS[s]).toBeDefined();
      for (const t of TRANSITIONS[s]) expect(STATUSES).toContain(t);
      expect(TRANSITIONS[s]).not.toContain(s);
    }
  });

  it("there are exactly five statuses", () => {
    expect([...STATUSES]).toEqual(["OPEN", "IN_REVIEW", "ON_HOLD", "RESOLVED", "CLOSED"]);
  });

  it("closed is final", () => {
    expect(TRANSITIONS.CLOSED).toEqual([]);
  });

  it("the main path Open → In review → Resolved → Closed works, with On hold as a detour", () => {
    const path: Status[] = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];
    for (let i = 0; i < path.length - 1; i++) expect(TRANSITIONS[path[i]]).toContain(path[i + 1]);
    expect(TRANSITIONS.IN_REVIEW).toContain("ON_HOLD");
    expect(TRANSITIONS.ON_HOLD).toContain("IN_REVIEW");
  });

  it("every status is reachable from Open", () => {
    const seen = new Set<Status>(["OPEN"]); const queue: Status[] = ["OPEN"];
    while (queue.length) for (const n of TRANSITIONS[queue.shift()!]) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    expect([...seen].sort()).toEqual([...STATUSES].sort());
  });

  it("reviewers can't close cases", () => {
    expect(REVIEWER_TARGETS).not.toContain("CLOSED");
    expect(REVIEWER_TARGETS).toEqual(expect.arrayContaining(["IN_REVIEW", "ON_HOLD", "RESOLVED"]));
  });

  it("progress bar maps On hold onto the In review step", () => {
    expect(stageIndex("OPEN")).toBe(0);
    expect(stageIndex("ON_HOLD")).toBe(stageIndex("IN_REVIEW"));
    expect(stageIndex("CLOSED")).toBe(STAGES.length - 1);
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
