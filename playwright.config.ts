import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3417);
export const BASE = `http://localhost:${PORT}`;

// Requires: database running (npm run db) and a production build (npm run build).
// Uses the locally installed Microsoft Edge, so no browser download is needed.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "storage/e2e/report", open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: { baseURL: BASE, extraHTTPHeaders: { Origin: BASE }, channel: "msedge", trace: "retain-on-failure" },
  projects: [
    { name: "api", testMatch: /.*\.api\.spec\.ts/ },
    { name: "desktop", testMatch: /.*\.ui\.spec\.ts/, use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "mobile", testMatch: /.*\.ui\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
  webServer: { command: `npx next start -p ${PORT}`, url: `${BASE}/login`, reuseExistingServer: true, timeout: 60_000 },
});
