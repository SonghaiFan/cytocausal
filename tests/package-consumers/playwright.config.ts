import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "consumer.spec.ts", workers: 1, timeout: 90000,
  use: { channel: process.env.CI ? undefined : "chrome", viewport: { width: 1440, height: 1000 } },
  reporter: "list",
});
