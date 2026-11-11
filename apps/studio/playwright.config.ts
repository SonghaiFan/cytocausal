import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "e2e", timeout: 60000, use: {baseURL:"http://localhost:3103",channel:"chrome",viewport:{width:1440,height:900}}, webServer:{command:"npm run start",url:"http://localhost:3103",reuseExistingServer:true} });
