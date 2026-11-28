import { PluginLoadError } from "@kaneo/plugin-loader";
import { describe, expect, it } from "vite-plus/test";
import { loadFailure } from "./load-failure.js";

describe("loadFailure", () => {
  it("keeps the boot error's heading, message and hint", () => {
    expect(
      loadFailure(
        new PluginLoadError({
          plugin: null,
          stage: "config",
          message: "plugins[0] is a function.",
          hint: "Fix /kaneo/kaneo.config.ts.",
        }),
      ),
    ).toMatchObject({
      _tag: "InvalidArgument",
      message:
        "Kaneo could not load its plugin config: plugins[0] is a function.",
      hint: "Fix /kaneo/kaneo.config.ts.",
    });
    expect(
      loadFailure(
        new PluginLoadError({
          plugin: "@kaneo/gantt",
          stage: "resolve",
          message: "Cannot find package '@kaneo/gantt'.",
          hint: "Reinstall Kaneo.",
        }),
      ).message,
    ).toBe(
      "Plugin \"@kaneo/gantt\" failed at resolve: Cannot find package '@kaneo/gantt'.",
    );
  });
});
