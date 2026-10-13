const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    headless: true,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "node scripts/serve-web.cjs",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
