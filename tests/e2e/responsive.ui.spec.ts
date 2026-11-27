import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { as, caseIdFor, options, submit } from "./helpers";
import { statePath } from "./fixtures";

// Layout sweep: every page at phone, tablet and desktop width must fit the screen (no sideways scrolling,
// nothing poking out past the right edge). Screenshots go to storage/e2e/shots for visual review.
const SIZES = [
  { name: "phone", width: 360, height: 760 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 860 },
];
const SHOTS = "storage/e2e/shots";
mkdirSync(SHOTS, { recursive: true });

// Viewport sizes are set inside each test, so run it once (desktop project) rather than per device.
test.beforeEach(({}, info) => { test.skip(info.project.name !== "desktop", "sizes are set per test"); test.setTimeout(240_000); });

/** Elements whose right edge is past the viewport (ignores intentionally scrollable strips and off-screen sidebars). */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.right <= vw + 1) continue;
      if (el.closest("[class*='overflow-x-auto'], [class*='overflow-hidden'], aside.hidden, [hidden]")) continue;
      if (getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).display === "none") continue;
      bad.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() ?? "").split(" ").slice(0, 3).join(".")} → ${Math.round(r.right)}px`);
    }
    return { pageWider: document.documentElement.scrollWidth > vw + 1, bad: bad.slice(0, 5) };
  });
}

async function sweep(page: Page, paths: string[], tag: string) {
  const problems: string[] = [];
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const p of paths) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      const o = await overflow(page);
      if (o.pageWider || o.bad.length) problems.push(`${size.name} ${p}: ${o.pageWider ? "PAGE SCROLLS SIDEWAYS; " : ""}${o.bad.join(" | ")}`);
      await page.screenshot({ path: `${SHOTS}/${tag}-${size.name}-${p.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}.png`, fullPage: true });
    }
  }
  return problems;
}

test.describe("public", () => {
  test("public pages fit every screen size", async ({ page }) => {
    const o = await options(await as("hr"));
    const s = await submit(o, { title: "Layout check case with a fairly long title to test wrapping on small screens" });
    await page.request.post("/api/anonymous/track", { data: { reference: s.reference, key: s.key } });
    const problems = await sweep(page, ["/", "/submit", "/track", `/track/${s.reference}`, "/login"], "public");
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

test.describe("HR", () => {
  test.use({ storageState: statePath("hr") });
  test("HR pages fit every screen size", async ({ page }) => {
    const hr = await as("hr");
    const { reference } = await submit(await options(hr), { title: "Layout check HR case" });
    const id = await caseIdFor(hr, reference);
    const problems = await sweep(page, ["/hr", "/hr/inbox", "/hr/assigned", `/hr/cases/${id}`, "/hr/reports?period=year", "/hr/account"], "hr");
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("changing status looks consistent at every step (phone and desktop)", async ({ page }) => {
    const hr = await as("hr");
    const { reference } = await submit(await options(hr), { title: "Status change check" });
    const id = await caseIdFor(hr, reference);
    for (const size of [SIZES[0], SIZES[2]]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(`/hr/cases/${id}`);
      await page.waitForLoadState("networkidle");
      // Every move between active statuses is allowed, so the same buttons work from any state.
      const steps = size.name === "phone" ? ["In review", "On hold", "Resolved", "Open"] : ["On hold", "Resolved", "In review", "Closed"];
      for (const [i, label] of steps.entries()) {
        await page.getByRole("group", { name: "Set status" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
        await expect(page.getByRole("group", { name: "Set status" }).getByRole("button", { name: new RegExp(`^${label}`) })).toHaveAttribute("aria-pressed", "true");
        // Header badge, progress bar and status buttons must all agree.
        await expect(page.locator("section").first()).toContainText(label);
        const o = await overflow(page);
        expect(o.pageWider || o.bad.length, `${size.name} after ${label}: ${o.bad.join(" | ")}`).toBeFalsy();
        await page.screenshot({ path: `${SHOTS}/status-${size.name}-${i + 1}-${label.replace(" ", "_")}.png`, fullPage: true });
      }
    }
  });
});

test.describe("Super Admin", () => {
  test.use({ storageState: statePath("super") });
  test("admin pages fit every screen size", async ({ page }) => {
    const hr = await as("hr");
    const { reference } = await submit(await options(hr), { title: "Layout check admin case" });
    const id = await caseIdFor(hr, reference);
    const problems = await sweep(page, [
      "/admin", "/admin/feedback", `/admin/feedback/${id}`, "/admin/reports?period=year", "/admin/staff", "/admin/departments",
      "/admin/categories", "/admin/audit", "/admin/notifications", "/admin/security", "/admin/settings",
    ], "admin");
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
