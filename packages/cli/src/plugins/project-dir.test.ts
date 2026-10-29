import { describe, expect, it } from "vite-plus/test";
import { resolveProjectDir } from "./project-dir.js";

const existing = (paths: string[]) => (path: string) => paths.includes(path);

describe("resolveProjectDir", () => {
  it("prefers --project, resolved against the working directory", () => {
    expect(
      resolveProjectDir({
        flag: "../my-kaneo",
        env: "/env/dir",
        cwd: "/home/me/work",
        exists: existing(["/kaneo"]),
      }),
    ).toBe("/home/me/my-kaneo");
  });

  it("falls back to KANEO_PROJECT_DIR", () => {
    expect(
      resolveProjectDir({
        flag: undefined,
        env: " /srv/kaneo ",
        cwd: "/home/me",
        exists: existing(["/kaneo"]),
      }),
    ).toBe("/srv/kaneo");
  });

  it("uses /kaneo when it exists, else the working directory", () => {
    expect(
      resolveProjectDir({
        flag: undefined,
        env: "",
        cwd: "/home/me",
        exists: existing(["/kaneo"]),
      }),
    ).toBe("/kaneo");
    expect(
      resolveProjectDir({
        flag: "  ",
        env: undefined,
        cwd: "/home/me",
        exists: () => false,
      }),
    ).toBe("/home/me");
  });
});
