import { describe, expect, it } from "vite-plus/test";
import { isInsideDirectory } from "./is-inside-directory.js";

describe("isInsideDirectory", () => {
  it("accepts nested paths", () => {
    expect(isInsideDirectory("/pkg/dist", "/pkg/dist/index.js")).toBe(true);
    expect(isInsideDirectory("/pkg/dist", "/pkg/dist/a/..b.js")).toBe(true);
  });

  it("rejects the directory itself, siblings and parents", () => {
    expect(isInsideDirectory("/pkg/dist", "/pkg/dist")).toBe(false);
    expect(isInsideDirectory("/pkg/dist", "/pkg/dist-other/x.js")).toBe(false);
    expect(isInsideDirectory("/pkg/dist", "/pkg/server.js")).toBe(false);
    expect(isInsideDirectory("/pkg/dist", "/etc/passwd")).toBe(false);
  });
});
