import { describe, expect, it } from "vite-plus/test";
import { joinApiUrl, toPluginAssetUrl } from "./plugin-urls";

describe("joinApiUrl", () => {
  it("joins with exactly one slash", () => {
    expect(joinApiUrl("https://api.test/api/plugins/p/", "/tasks/1")).toBe(
      "https://api.test/api/plugins/p/tasks/1",
    );
    expect(joinApiUrl("https://api.test/api", "tasks?x=1")).toBe(
      "https://api.test/api/tasks?x=1",
    );
    expect(joinApiUrl("https://api.test/api/", "")).toBe(
      "https://api.test/api",
    );
  });
});

describe("toPluginAssetUrl", () => {
  it("prefixes asset paths with the API base and keeps the version query", () => {
    expect(
      toPluginAssetUrl(
        "https://kaneo.test/api",
        "/plugins/kaneo-plugin-task-progress/assets/index.js?v=0.1.0",
      ),
    ).toBe(
      "https://kaneo.test/api/plugins/kaneo-plugin-task-progress/assets/index.js?v=0.1.0",
    );
  });

  it("keeps absolute asset URLs", () => {
    expect(
      toPluginAssetUrl("https://kaneo.test/api", "https://cdn.test/a.js"),
    ).toBe("https://cdn.test/a.js");
  });
});
