import { describe, expect, it } from "vite-plus/test";
import { listExportTargets } from "./export-targets.js";

describe("listExportTargets", () => {
  it("lists every file target and skips patterns", () => {
    expect(
      listExportTargets({
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        "./server": "./dist/server.js",
        "./web": { import: ["./dist/web/index.js"] },
        "./assets/*": "./dist/assets/*",
        "./missing": null,
      }),
    ).toEqual([
      { key: ".", target: "./dist/index.d.ts" },
      { key: ".", target: "./dist/index.js" },
      { key: "./server", target: "./dist/server.js" },
      { key: "./web", target: "./dist/web/index.js" },
    ]);
  });

  it("treats a string exports field as the root export", () => {
    expect(listExportTargets("./dist/index.js")).toEqual([
      { key: ".", target: "./dist/index.js" },
    ]);
  });
});
