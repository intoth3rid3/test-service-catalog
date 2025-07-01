import { defineConfig } from "cypress";

export default defineConfig({
  watchForFileChanges: false,
  chromeWebSecurity: false,

  e2e: {
    baseUrl: "https://cloud.konghq.com",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  viewportWidth: 1920,
  viewportHeight: 1080
});
