import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env["BASE_URL"] ?? "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  /* In CI, servers are started manually by the workflow — skip webServer */
  ...(!process.env["CI"] && {
    webServer: [
      {
        command: "pnpm --filter backend dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 30_000,
        env: { NODE_ENV: "test" },
      },
      {
        command: "pnpm --filter webapp dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 15_000,
      },
    ],
  }),
});
