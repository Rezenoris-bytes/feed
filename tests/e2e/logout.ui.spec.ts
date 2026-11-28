import { expect, test } from "@playwright/test";
import { accounts } from "./fixtures";
import { as, options, submit } from "./helpers";

// After signing out, Back must never show a staff screen again (no cached page, no cached data).
test("signing out then pressing Back does not show the staff screen", async ({ page }) => {
  const a = accounts().hr;
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(a.email);
  await page.getByLabel("Password").fill(a.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/hr$/);
  // Navigate the way people do: by clicking the sidebar (in-app navigation, pages kept in the app's memory).
  await page.waitForLoadState("networkidle");
  await page.locator('a[href="/hr/inbox"]:visible').first().click(); // sidebar on desktop, bottom bar on phones
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await page.locator('a[href="/hr/assigned"]:visible').first().click();
  await expect(page.getByRole("heading", { name: "Assigned to me" })).toBeVisible();

  await page.locator('button[aria-label="Sign out"]:visible').first().click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goBack();
  await page.waitForLoadState("networkidle");
  // Must end on the sign-in page, with no inbox content visible.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Inbox" })).toHaveCount(0);

  await page.goForward().catch(() => {});
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Inbox" })).toHaveCount(0);
});

test("locking a tracked case then pressing Back does not show the case", async ({ page }, info) => {
  const s = await submit(await options(await as("hr")), { title: `Lock-back ${info.project.name}` });
  await page.goto("/track");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Reference").fill(s.reference);
  await page.getByLabel("Secret key").fill(s.key);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Lock-back/ })).toBeVisible();
  await page.getByRole("button", { name: "Lock" }).click();
  await expect(page).toHaveURL(/\/track$/);
  await page.goBack();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /Lock-back/ })).toHaveCount(0);
});
