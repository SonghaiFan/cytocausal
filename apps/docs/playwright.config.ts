import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3200",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run start -- -p 3200",
    url: `http://localhost:3200${process.env.NEXT_PUBLIC_BASE_PATH || ""}/en/`,
    reuseExistingServer: true,
  },
});
