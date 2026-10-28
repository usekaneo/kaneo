import { describe, expect, it } from "vite-plus/test";
import { checkChangeset } from "./changeset-policy";
import { CHANGESET_LIMITS, type ChangesWithFiles } from "./changeset-schema";

const baseSha = "a".repeat(40);
const target = {
  baseSha,
  branch: "web-1-kaneo-abcdef",
  protectedRefs: ["main"],
};
const b64 = (text: string) => Buffer.from(text).toString("base64");

function changeset(files: ChangesWithFiles["files"]): ChangesWithFiles {
  return {
    outcome: "changes",
    baseSha,
    title: "Fix",
    body: "",
    commitMessage: "Fix",
    files,
  };
}
const upsert = (path: string, content = "x", mode = "100644" as const) => ({
  action: "upsert" as const,
  path,
  mode,
  content: b64(content),
});

describe("changeset policy", () => {
  it("accepts ordinary edits and deletes", () => {
    const result = checkChangeset(
      changeset([
        upsert("src/app.ts", "export {}"),
        { action: "delete", path: "old.txt" },
        upsert(".github/ISSUE_TEMPLATE/bug.md"),
      ]),
      target,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.files[0]).toMatchObject({
        path: "src/app.ts",
        bytes: Buffer.from("export {}"),
      });
  });

  it("never targets the default branch or a different base commit", () => {
    expect(
      checkChangeset(changeset([upsert("a")]), { ...target, branch: "main" }),
    ).toEqual({ ok: false, violation: "protected_branch" });
    expect(
      checkChangeset(changeset([upsert("a")]), {
        ...target,
        baseSha: "b".repeat(40),
      }),
    ).toEqual({ ok: false, violation: "base_mismatch" });
  });

  it.each([
    ".github/workflows/ci.yml",
    ".github/workflows",
    ".github/actions",
    ".github",
    ".GitHub/Workflows/deploy.yaml",
    ".github/actions/setup/action.yml",
    ".gitea/workflows/ci.yml",
    ".forgejo/workflows/ci.yml",
    ".gitlab-ci.yml",
  ])("refuses CI file %s", (path) => {
    expect(checkChangeset(changeset([upsert(path)]), target)).toEqual({
      ok: false,
      violation: "ci_file",
      path,
    });
    expect(
      checkChangeset(changeset([{ action: "delete", path }]), target),
    ).toMatchObject({ violation: "ci_file" });
  });

  it.each([
    "/etc/passwd",
    "C:/Windows/system.ini",
    "../outside",
    "src/../../outside",
    "src/./file",
    "src//file",
    "src/",
    "src\\file",
    "src/\u0000file",
  ])("refuses path traversal or malformed path %j", (path) => {
    expect(checkChangeset(changeset([upsert(path)]), target)).toEqual({
      ok: false,
      violation: "invalid_path",
    });
  });

  it("refuses git metadata anywhere in the tree", () => {
    for (const path of [".git/config", "vendor/.GIT/hooks/post-checkout"])
      expect(checkChangeset(changeset([upsert(path)]), target)).toMatchObject({
        violation: "git_directory",
      });
  });

  it.each(["../../etc/passwd", "/etc/passwd", "../.git/config", ""])(
    "refuses symlinks that escape the repository (%j)",
    (link) => {
      expect(
        checkChangeset(
          changeset([{ ...upsert("docs/link", link), mode: "120000" }]),
          target,
        ),
      ).toMatchObject({ ok: false, violation: "symlink_escape" });
    },
  );

  it("refuses duplicates, bad base64, and oversized changesets", () => {
    expect(
      checkChangeset(changeset([upsert("a"), upsert("a")]), target),
    ).toMatchObject({ violation: "duplicate_path" });
    expect(
      checkChangeset(
        changeset([{ ...upsert("a"), content: "not base64!" }]),
        target,
      ),
    ).toMatchObject({ violation: "invalid_content" });
    const half = "x".repeat(CHANGESET_LIMITS.bytes / 2 + 1);
    expect(
      checkChangeset(changeset([upsert("a", half), upsert("b", half)]), target),
    ).toEqual({ ok: false, violation: "too_large" });
    expect(
      checkChangeset(
        changeset(
          Array.from({ length: CHANGESET_LIMITS.files + 1 }, (_, index) =>
            upsert(`f${index}`),
          ),
        ),
        target,
      ),
    ).toEqual({ ok: false, violation: "too_many_files" });
  });
});
