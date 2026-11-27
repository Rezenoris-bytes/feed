import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { statePath } from "./fixtures";

const noHorizontalScroll = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

test("public home is installable, white theme, and fits the screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Speak up/ })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest/);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect((await page.request.get("/sw.js")).status()).toBe(200);
  // Render the body colour to a pixel so any CSS colour format (oklch, rgb) can be compared.
  const lum = await page.evaluate(() => {
    const c = document.createElement("canvas").getContext("2d")!;
    c.fillStyle = getComputedStyle(document.body).backgroundColor; c.fillRect(0, 0, 1, 1);
    const [r, g, b] = c.getImageData(0, 0, 1, 1).data; return Math.min(r, g, b);
  });
  expect(lum).toBeGreaterThan(240); // white theme
  await noHorizontalScroll(page);
});

test("employee: submit without login, save key, then track the case", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Give feedback/ }).click();
  await expect(page.getByRole("heading", { name: "Give feedback" })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("radio", { name: "Suggestion" }).click();
  await page.getByRole("radio", { name: "Low" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Title").fill(`[e2e] UI ${info.project.name}`);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByLabel("What happened?").fill("It would help to have a second water dispenser near the loading bay.");
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#123" } }).png().toBuffer();
  await page.locator("#files").setInputFiles({ name: "my_photo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Attachment 1")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Nobody, including administrators")).toBeVisible();
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("heading", { name: "Sent anonymously" })).toBeVisible({ timeout: 30_000 });
  const ref = (await page.locator("dd").nth(0).textContent())!.trim();
  const key = (await page.locator("dd").nth(1).textContent())!.trim();
  await page.getByRole("button", { name: "I took a screenshot" }).click();
  await page.getByRole("link", { name: /Go to tracking/ }).click();
  await page.getByLabel("Reference").fill(ref);
  await page.getByLabel("Secret key").fill(key);
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: `[e2e] UI ${info.project.name}` })).toBeVisible();
  await expect(page.getByText("my_photo")).toHaveCount(0);
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Lock" }).click();
  await expect(page).toHaveURL(/\/track$/);
});

test("staff login page has no employee sign-in and links to the public form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Send feedback" })).toBeVisible();
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@e2e.feed.test`);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("Email or password is incorrect");
});

test("theme switch cycles device → light → dark and remembers the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  await expect.poll(isDark).toBe(false);
  await page.waitForLoadState("networkidle"); // interactive (hydrated) before clicking
  const toggle = page.getByRole("button", { name: /Theme:/ });
  await expect(toggle).toHaveAttribute("title", "Theme: match device");
  await toggle.click();
  await expect(toggle).toHaveAttribute("title", "Theme: light");
  await toggle.click();
  await expect(toggle).toHaveAttribute("title", "Theme: dark");
  await expect.poll(isDark).toBe(true);
  await page.reload();
  await expect.poll(isDark).toBe(true); // remembered, applied before paint
  await page.waitForLoadState("networkidle");
  await expect(toggle).toHaveAttribute("title", "Theme: dark");
  await toggle.click();
  await expect(toggle).toHaveAttribute("title", "Theme: match device");
  await expect.poll(isDark).toBe(false);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(isDark).toBe(true); // follows the device live
});

test.describe("HR", () => {
  test.use({ storageState: statePath("hr") });

  test("dashboard stat cards line up (equal heights, one-line labels)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // measure final positions, not the entrance animation
    await page.goto("/hr?period=year");
    const cards = page.locator("main .grid").first().locator("> div");
    await expect(cards).toHaveCount(7);
    const heights = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
    const tops = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    // Cards in the same row share the same top edge.
    const rows = new Map<number, number>(); for (const t of tops) rows.set(t, (rows.get(t) ?? 0) + 1);
    expect([...rows.keys()].length).toBeLessThanOrEqual(4);
  });

  test("dashboard and inbox render; dropdowns are styled; no script injection runs", async ({ page }) => {
    let alerted = false;
    page.on("dialog", (d) => { alerted = true; d.dismiss(); });
    await page.goto("/hr");
    await expect(page.getByText("Monthly trend")).toBeVisible();
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await page.goto("/hr/inbox?status=all");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Status" }).getByRole("link", { name: /In review/ })).toBeVisible(); // status tabs
    await noHorizontalScroll(page);
    await page.getByText("Filters").click();
    const select = page.locator('select[name="category"]');
    expect(await select.evaluate((el) => getComputedStyle(el).appearance)).toBe("none");
    await expect(page.locator('select[name="category"] + svg')).toBeVisible();
    const xss = page.getByText("<img src=x onerror=alert(1)>", { exact: false }).first();
    if (await xss.count()) { await xss.click(); await page.waitForLoadState("networkidle"); }
    expect(alerted).toBe(false);
  });
});
