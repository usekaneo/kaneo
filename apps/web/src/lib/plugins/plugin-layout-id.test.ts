import { describe, expect, it } from "vite-plus/test";
import {
  isPluginLayoutId,
  parsePluginLayoutId,
  pluginLayoutId,
} from "./plugin-layout-id";

describe("plugin layout ids", () => {
  it("round-trips a plugin view, keeping colons in the view id", () => {
    const id = pluginLayoutId({ pluginId: "gantt", viewId: "time:line" });
    expect(id).toBe("plugin:gantt:time:line");
    expect(parsePluginLayoutId(id)).toEqual({
      pluginId: "gantt",
      viewId: "time:line",
    });
  });

  it("rejects core layouts and malformed ids", () => {
    for (const value of [
      "board",
      "gantt",
      "plugin:",
      "plugin:gantt",
      "plugin::timeline",
      "plugin:gantt:",
      null,
      7,
    ]) {
      expect(isPluginLayoutId(value)).toBe(false);
    }
  });
});
