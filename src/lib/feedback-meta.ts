// Shared (client + server) labels and workflow rules.
export const STATUSES = [
  "SUBMITTED", "RECEIVED", "UNDER_REVIEW", "ASSIGNED", "INVESTIGATION", "ACTION_REQUIRED",
  "RESOLVED", "CLOSED", "REJECTED", "DUPLICATE", "ESCALATED", "AWAITING_INFO",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  SUBMITTED: "Submitted", RECEIVED: "Received", UNDER_REVIEW: "Under review", ASSIGNED: "Assigned",
  INVESTIGATION: "Investigation", ACTION_REQUIRED: "Action required", RESOLVED: "Resolved", CLOSED: "Closed",
  REJECTED: "Rejected", DUPLICATE: "Duplicate", ESCALATED: "Escalated", AWAITING_INFO: "Awaiting information",
};

export const STATUS_TONE: Record<Status, "neutral" | "info" | "warn" | "good" | "bad"> = {
  SUBMITTED: "info", RECEIVED: "info", UNDER_REVIEW: "info", ASSIGNED: "info", INVESTIGATION: "warn",
  ACTION_REQUIRED: "warn", RESOLVED: "good", CLOSED: "neutral", REJECTED: "bad", DUPLICATE: "neutral",
  ESCALATED: "bad", AWAITING_INFO: "warn",
};

/** Normal (HR) transitions. Super Admin may override to any status (recorded in the audit log). */
export const TRANSITIONS: Record<Status, Status[]> = {
  SUBMITTED: ["RECEIVED", "UNDER_REVIEW", "REJECTED", "DUPLICATE"],
  RECEIVED: ["UNDER_REVIEW", "REJECTED", "DUPLICATE"],
  UNDER_REVIEW: ["ASSIGNED", "ACTION_REQUIRED", "AWAITING_INFO", "ESCALATED", "REJECTED", "DUPLICATE"],
  ASSIGNED: ["INVESTIGATION", "AWAITING_INFO", "ESCALATED"],
  INVESTIGATION: ["ACTION_REQUIRED", "RESOLVED", "AWAITING_INFO", "ESCALATED"],
  ACTION_REQUIRED: ["RESOLVED", "INVESTIGATION", "ESCALATED"],
  AWAITING_INFO: ["UNDER_REVIEW", "INVESTIGATION"],
  ESCALATED: ["INVESTIGATION", "ACTION_REQUIRED", "RESOLVED"],
  RESOLVED: ["CLOSED", "INVESTIGATION"],
  CLOSED: [],
  REJECTED: [],
  DUPLICATE: [],
};

/** Reviewers may only move work forward within an investigation. */
export const REVIEWER_TARGETS: Status[] = ["INVESTIGATION", "ACTION_REQUIRED", "AWAITING_INFO", "RESOLVED"];
export const OPEN_STATUSES: Status[] = STATUSES.filter((s) => !["RESOLVED", "CLOSED", "REJECTED", "DUPLICATE"].includes(s));

export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_ATTACHMENTS = 5;
