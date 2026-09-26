import { defineConfig } from "@playwright/test";

const host = process.env.KANEO_E2E_HOST ?? "localhost";
if (host !== "localhost" && host !== "bs-local.com") {
  throw new Error("KANEO_E2E_HOST must be localhost or bs-local.com");
}

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
    actionTimeout: 15_000,
    // This port belongs to the disposable Compose stack, never a live instance.
    baseURL: `http://${host}:18173`,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
