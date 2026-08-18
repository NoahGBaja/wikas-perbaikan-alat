import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/blackbox",
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: ".data/blackbox/report", open: "never" }]],
  use: {
    baseURL: process.env.BLACKBOX_BASE_URL || "http://127.0.0.1:3200",
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: "desktop-edge", use: { ...devices["Desktop Edge"] } },
    {
      name: "mobile-edge",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  outputDir: ".data/blackbox/test-results",
});
