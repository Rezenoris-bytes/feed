import { expect, test } from "@playwright/test";
import { anon, as, caseIdFor, options, submit, track } from "./helpers";
import { prisma } from "./fixtures";

test("full lifecycle: Open → (assign) In review → On hold → reply → Resolved → Closed → reopen", async () => {
  const [hr, rev, sup] = await Promise.all([as("hr"), as("reviewer"), as("super")]);
  const o = await options(hr);
  const { res, reference, key } = await submit(o, { title: "Lifecycle case" });
  expect(res.status()).toBe(201);
  const id = await caseIdFor(hr, reference);
  const act = (ctx: typeof hr, data: object) => ctx.post(`/api/cases/${id}`, { data });
  const status = async () => (await prisma.feedbackSubmission.findUnique({ where: { id } }))!.status;
  expect(await status()).toBe("OPEN");

  // Assigning an open case starts the review.
  const html = await (await hr.get(`/hr/cases/${id}`)).text();
  const reviewerId = html.match(/<option value="([0-9a-f-]{36})">E2E Ops Reviewer/)![1];
  expect((await act(hr, { action: "assign", assigneeId: reviewerId })).status()).toBe(200);
  expect(await status()).toBe("IN_REVIEW");
  expect((await act(hr, { action: "status", to: "OPEN" })).status()).toBe(400); // can't go back to Open

  expect((await act(rev, { action: "status", to: "CLOSED" })).status()).toBe(403); // reviewers can't close
  expect((await act(rev, { action: "status", to: "ON_HOLD" })).status()).toBe(200);
  expect((await act(rev, { action: "message", body: "Which room exactly?" })).status()).toBe(200);

  const sender = await track(reference, key);
  const view = await (await sender.get(`/track/${reference}`)).text();
  expect(view).toContain("Which room exactly?");
  expect(view).toContain("Feedback team");
  expect(view).not.toContain("E2E Ops Reviewer");
  expect((await sender.post("/api/anonymous/messages", { data: { reference, body: "Room 2.14" } })).status()).toBe(200);
  expect(await status()).toBe("IN_REVIEW"); // a reply while on hold resumes the review

  expect((await act(hr, { action: "status", to: "RESOLVED" })).status()).toBe(200);
  expect((await act(hr, { action: "status", to: "CLOSED" })).status()).toBe(200);
  expect((await sender.post("/api/anonymous/messages", { data: { reference, body: "thanks" } })).status()).toBe(400); // closed
  expect((await act(hr, { action: "status", to: "IN_REVIEW" })).status()).toBe(400); // HR can't reopen a closed case

  // Super Admin override reopens with an audit record.
  expect((await sup.post(`/api/cases/${id}`, { data: { action: "status", to: "IN_REVIEW" } })).status()).toBe(200);
  expect(await prisma.auditLog.count({ where: { target: id, action: "feedback.status.override" } })).toBe(1);

  const history = await prisma.feedbackStatusHistory.findMany({ where: { feedbackId: id }, orderBy: { createdAt: "asc" } });
  expect(history.map((h) => h.toStatus)).toEqual(["OPEN", "IN_REVIEW", "ON_HOLD", "IN_REVIEW", "RESOLVED", "CLOSED", "IN_REVIEW"]);
  expect(history[0].actorId).toBeNull();
});
test("sensitive categories are raised to High and hidden from department reviewers", async () => {
  const [hr, rev] = await Promise.all([as("hr"), as("reviewer")]);
  const { reference } = await submit(await options(hr), { title: "Sensitive report", category: "Harassment or misconduct" });
  const id = await caseIdFor(hr, reference);
  expect((await prisma.feedbackSubmission.findUnique({ where: { id }, include: { priority: true } }))!.priority.key).toBe("HIGH");
  expect((await rev.get(`/hr/cases/${id}`)).status()).toBe(404);
});

test("concurrent anonymous submissions all succeed with unique references and keys", async () => {
  const o = await options(await as("hr"));
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => submit(o, { title: `Concurrent ${i}` })));
  expect(results.every((r) => r.res.status() === 201)).toBe(true);
  expect(new Set(results.map((r) => r.reference)).size).toBe(8);
  expect(new Set(results.map((r) => r.key)).size).toBe(8);
});

test("large descriptions and pagination", async () => {
  const hr = await as("hr");
  const o = await options(hr);
  expect((await submit(o, { title: "big", description: "x".repeat(10_000) })).res.status()).toBe(201);
  expect((await submit(o, { title: "too big", description: "x".repeat(10_001) })).res.status()).toBe(400);
  const t0 = Date.now();
  expect((await hr.get("/hr/inbox?status=all&page=1")).status()).toBe(200);
  expect(Date.now() - t0).toBeLessThan(3000);
  void anon;
});

test("internal notes and remarks no longer exist", async () => {
  const hr = await as("hr");
  const { reference } = await submit(await options(hr), { title: "No notes" });
  const id = await caseIdFor(hr, reference);
  expect((await hr.post(`/api/cases/${id}`, { data: { action: "note", body: "x" } })).status()).toBe(400);
  const html = await (await hr.get(`/hr/cases/${id}`)).text();
  expect(html).not.toContain("Internal notes");
  expect(html).not.toContain("Internal remark");
});
