import { describe, expect, it } from "vite-plus/test";
import { catalogStatus } from "./catalog-status.js";

describe("catalogStatus", () => {
  it("finds listed packages by npm name", () => {
    const index = {
      plugins: [{ package: "kaneo-plugin-task-progress", repository: "x" }],
    };
    expect(catalogStatus(index, "kaneo-plugin-task-progress")).toBe("listed");
    expect(catalogStatus(index, "kaneo-plugin-other")).toBe("unlisted");
    expect(catalogStatus({ plugins: [] }, "x")).toBe("unlisted");
  });

  it("returns null for anything that is not an index", () => {
    expect(catalogStatus(null, "x")).toBeNull();
    expect(catalogStatus([], "x")).toBeNull();
    expect(catalogStatus({ plugins: {} }, "x")).toBeNull();
  });
});
