import { defineServer } from "@kaneo/plugin-sdk/server";
import plugin from "./index.js";
import { registerEvents } from "./server/events.js";
import { registerRoutes } from "./server/routes.js";
import { settings } from "./server/settings.js";

export default defineServer(plugin, {
  settings,
  setup(kaneo) {
    registerRoutes(kaneo);
    registerEvents(kaneo);
    kaneo.log.info(
      `Tracking task progress, auto-complete is ${kaneo.options.autoComplete ? "on" : "off"}`,
    );
  },
});
