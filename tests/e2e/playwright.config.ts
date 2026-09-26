import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "../../.cache/e2e/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../.cache/e2e/report", open: "never" }],
  ],
  use: {
    // This port belongs to the disposable Compose stack, never a live instance.
    baseURL: "http://localhost:18173",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
