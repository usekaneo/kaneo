import { describe, expect, it } from "vite-plus/test";
import {
  findRepoConfig,
  hasRepoLink,
  linkFilePath,
  mergeRepoLink,
  parseRepoConfigObject,
  removeRepoLink,
  serializeRepoConfig,
} from "./repo-config.js";

describe("findRepoConfig", () => {
  const files: Record<string, string> = {
    "/work/app/.kaneo.json": '{"workspace":"ws_1","project":"KAN"}',
    "/broken/.kaneo.json": "{nope",
  };
  const read = (path: string) => files[path];

  it("walks up from the working directory", () => {
    expect(findRepoConfig("/work/app/src/deep", read)).toEqual({
      path: "/work/app/.kaneo.json",
      workspace: "ws_1",
      project: "KAN",
    });
  });

  it("returns nothing when no file exists or it is not JSON", () => {
    expect(findRepoConfig("/elsewhere/x", read)).toBeUndefined();
    expect(findRepoConfig("/broken/a", read)).toBeUndefined();
  });
});

describe("linkFilePath", () => {
  const existing = (paths: ReadonlyArray<string>) => (path: string) =>
    paths.includes(path);

  it("writes at the git repository root", () => {
    expect(linkFilePath("/repo/packages/app", existing(["/repo/.git"]))).toBe(
      "/repo/.kaneo.json",
    );
  });

  it("updates a closer .kaneo.json inside the repository", () => {
    expect(
      linkFilePath(
        "/repo/packages/app/src",
        existing(["/repo/.git", "/repo/packages/app/.kaneo.json"]),
      ),
    ).toBe("/repo/packages/app/.kaneo.json");
  });

  it("uses the current directory outside a repository", () => {
    expect(linkFilePath("/tmp/scratch", existing(["/tmp/.kaneo.json"]))).toBe(
      "/tmp/scratch/.kaneo.json",
    );
  });
});

describe("parseRepoConfigObject", () => {
  it("distinguishes missing, valid and invalid files", () => {
    expect(parseRepoConfigObject(undefined)).toEqual({ kind: "missing" });
    expect(parseRepoConfigObject("")).toEqual({ kind: "ok", value: {} });
    expect(parseRepoConfigObject('{"a":1}')).toEqual({
      kind: "ok",
      value: { a: 1 },
    });
    expect(parseRepoConfigObject("[1]")).toEqual({ kind: "invalid" });
    expect(parseRepoConfigObject("{nope")).toEqual({ kind: "invalid" });
  });
});

describe("mergeRepoLink", () => {
  it("keeps keys written by other tools and their order", () => {
    const merged = mergeRepoLink(
      { project: "OLD", board: "main", workspace: "ws_old" },
      { workspace: "ws_1", project: "KAN" },
    );
    expect(serializeRepoConfig(merged)).toBe(
      '{\n  "project": "KAN",\n  "board": "main",\n  "workspace": "ws_1"\n}\n',
    );
  });

  it("creates a new file with only the workspace and project", () => {
    expect(
      mergeRepoLink(undefined, { workspace: "ws_1", project: "KAN" }),
    ).toEqual({ workspace: "ws_1", project: "KAN" });
  });
});

describe("removeRepoLink", () => {
  it("removes only the link keys", () => {
    const value = { workspace: "ws_1", project: "KAN", board: "main" };
    expect(hasRepoLink(value)).toBe(true);
    expect(removeRepoLink(value)).toEqual({ board: "main" });
  });

  it("returns nothing when no other keys remain", () => {
    expect(
      removeRepoLink({ workspace: "ws_1", project: "KAN" }),
    ).toBeUndefined();
    expect(hasRepoLink({ board: "main" })).toBe(false);
  });
});
