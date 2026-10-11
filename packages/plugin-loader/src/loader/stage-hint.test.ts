import { describe, expect, it } from "vite-plus/test";
import { stageHint } from "./stage-hint.js";

describe("stageHint", () => {
  it("points configured plugins at their entry in the config", () => {
    expect(stageHint("compatibility", "/kaneo/kaneo.config.ts", "3.0.0")).toBe(
      "Install a version that supports Kaneo 3.0.0, or remove it from /kaneo/kaneo.config.ts.",
    );
  });

  it("tells operators how to turn off a built-in plugin", () => {
    expect(
      stageHint("compatibility", "/kaneo/kaneo.config.ts", "3.0.0", "gantt"),
    ).toBe(
      "This plugin ships with Kaneo. Turn it off with official: { gantt: false } in /kaneo/kaneo.config.ts, or report it to the Kaneo maintainers.",
    );
  });
});
