// Shared (client + server) labels and workflow rules.
// Five simple statuses: Open → In review → (On hold) → Resolved → Closed.
export const STATUSES = ["OPEN", "IN_REVIEW", "ON_HOLD", "RESOLVED", "CLOSED"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Open", IN_REVIEW: "In review", ON_HOLD: "On hold", RESOLVED: "Resolved", CLOSED: "Closed",
};

/** One short line per status, written for the person who sent the feedback. */
export const STATUS_HINT: Record<Status, string> = {
  OPEN: "Received. Waiting for the team.",
  IN_REVIEW: "The team is looking into it.",
  ON_HOLD: "Paused. The team may need more from you.",
  RESOLVED: "Action taken.",
  CLOSED: "This case is finished.",
};

export const STATUS_TONE: Record<Status, "open" | "review" | "hold" | "good" | "neutral"> = {
  OPEN: "open", IN_REVIEW: "review", ON_HOLD: "hold", RESOLVED: "good", CLOSED: "neutral",
};

/** Main path shown as a progress bar. On hold is a pause within "In review". */
export const STAGES: Status[] = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];
export function stageIndex(s: Status) {
  return s === "ON_HOLD" ? 1 : STAGES.indexOf(s);
}

/** Allowed moves for HR: any active status to any other; Closed is final. Super Admin may reopen (recorded in the audit log). */
export const TRANSITIONS: Record<Status, Status[]> = {
  OPEN: STATUSES.filter((s) => s !== "OPEN"),
  IN_REVIEW: STATUSES.filter((s) => s !== "IN_REVIEW"),
  ON_HOLD: STATUSES.filter((s) => s !== "ON_HOLD"),
  RESOLVED: STATUSES.filter((s) => s !== "RESOLVED"),
  CLOSED: [],
};

/** Reviewers can work a case but not close it. */
export const REVIEWER_TARGETS: Status[] = ["IN_REVIEW", "ON_HOLD", "RESOLVED"];
export const OPEN_STATUSES: Status[] = ["OPEN", "IN_REVIEW", "ON_HOLD"];
export const isFinal = (s: string) => s === "CLOSED";

export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_ATTACHMENTS = 5;
