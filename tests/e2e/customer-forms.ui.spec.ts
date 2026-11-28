import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { E2E_TAG, statePath } from "./fixtures";

// Walks the customer-form screens the way staff and a customer use them, on phone and desktop.
const SHOTS = "storage/e2e/shots";
mkdirSync(SHOTS, { recursive: true });
const shot = (name: string, info: { project: { name: string } }) => `${SHOTS}/cust-${info.project.name}-${name}.png`;

test.use({ storageState: statePath("hr") });

test("build, publish, send and answer a customer form", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  await page.goto("/hr/customers");
  await page.getByRole("button", { name: "New form" }).click();
  await page.getByRole("button", { name: /Service cancellation/ }).click();
  await page.waitForURL(/\/hr\/customers\/[0-9a-f-]{36}\?tab=questions/);

  // Builder: rename, add a question, save.
  await page.getByLabel("Form title").fill(`${E2E_TAG} Cancellation ${info.project.name}`);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("menuitem", { name: "Star rating" }).click();
  await page.getByLabel("Question", { exact: true }).last().fill("How was our engineer?");
  await page.screenshot({ path: shot("builder", info), fullPage: true });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  // Send: one customer, WhatsApp link ready.
  await page.getByRole("link", { name: "Send" }).click();
  await page.getByLabel("Customer name *").fill("Meena Traders");
  await page.getByLabel("WhatsApp number").fill("+91 98765 43210");
  await page.getByLabel(/Machine/).fill("Laser LX-300");
  await page.screenshot({ path: shot("send", info), fullPage: true });
  await page.getByRole("button", { name: "Create link" }).click();
  const wa = page.getByRole("link", { name: "WhatsApp" });
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=.*Meena%20Traders/);
  await page.screenshot({ path: shot("link-ready", info), fullPage: true });
  const link = (await page.locator("button.font-mono").innerText()).trim();
  expect(link).toMatch(/\/f\/[A-Za-z0-9_-]{20,}$/);

  // Customer answers (fresh browser, no login).
  const ctx = await browser.newContext({ ...(info.project.use ?? {}), storageState: undefined });
  const c = await ctx.newPage();
  await c.goto(link);
  await expect(c.getByText("Hi Meena Traders")).toBeVisible();
  await c.getByRole("button", { name: "Send answers" }).click();
  await expect(c.getByRole("alert").filter({ hasText: "Main reason for cancelling" })).toBeVisible();
  await c.getByRole("radio", { name: "Machine problems" }).click();
  await c.getByRole("checkbox", { name: "Breakdowns" }).click();
  await c.getByRole("radiogroup", { name: "How was our engineer?" }).getByRole("radio", { name: "4 of 5" }).click();
  await c.screenshot({ path: shot("customer", info), fullPage: true });
  await c.getByRole("button", { name: "Send answers" }).click();
  await expect(c.getByText("Thank you, Meena Traders")).toBeVisible();
  await c.screenshot({ path: shot("customer-done", info) });
  await ctx.close();

  // Replies tab shows the summary and the answer.
  await page.reload();
  await page.getByRole("link", { name: /Replies/ }).click();
  await expect(page.getByText("Meena Traders").first()).toBeVisible();
  await page.locator("details summary").filter({ hasText: "Meena Traders" }).click();
  await expect(page.locator("details[open] dd").filter({ hasText: "Machine problems" })).toBeVisible();
  await page.screenshot({ path: shot("replies", info), fullPage: true });

  const wider = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(wider).toBe(false);
});
