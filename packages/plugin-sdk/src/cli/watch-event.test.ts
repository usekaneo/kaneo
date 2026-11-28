import { describe, expect, it } from "vite-plus/test";
import { makeTheme } from "./output/theme.js";
import { renderWatchEvent } from "./watch-event.js";

const theme = makeTheme(false);

describe("renderWatchEvent", () => {
  it("describes each watch event on one line", () => {
    expect(
      renderWatchEvent(theme, {
        event: "watching",
        plugin: {
          id: "gantt",
          name: "Gantt",
          packageName: "@kaneo/gantt",
          version: "0.1.0",
          engines: null,
        },
      }),
    ).toBe("Watching for changes. Press Ctrl+C to stop.");
    expect(
      renderWatchEvent(theme, { event: "built", target: "node", warnings: [] }),
    ).toBe("Built server entries");
    expect(
      renderWatchEvent(theme, { event: "built", target: "web", warnings: [] }),
    ).toBe("Built web entry");
    expect(
      renderWatchEvent(theme, {
        event: "error",
        target: "web",
        error: "Unexpected token",
      }),
    ).toBe("error: Unexpected token");
  });
});
