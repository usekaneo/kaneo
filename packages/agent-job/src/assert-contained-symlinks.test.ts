import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { assertContainedSymlinks } from "./assert-contained-symlinks.js";

let root: string;
let checkout: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "kaneo-link-test-"));
  checkout = join(root, "checkout");
  await mkdir(checkout);
});
afterEach(async () => rm(root, { recursive: true, force: true }));

it("allows resolved file and directory symlinks that stay inside the checkout", async () => {
  await mkdir(join(checkout, "src"));
  await writeFile(join(checkout, "src", "file.txt"), "safe");
  await symlink("src", join(checkout, "directory-link"));
  await symlink("src/file.txt", join(checkout, "file-link"));
  await expect(assertContainedSymlinks(checkout)).resolves.toBeUndefined();
});

it("rejects an existing directory symlink outside the checkout", async () => {
  await mkdir(join(root, "outside"));
  await symlink("../outside", join(checkout, "outside-link"));
  await expect(assertContainedSymlinks(checkout)).rejects.toThrow(
    "outside the checkout",
  );
});

it("rejects a symlink chain that resolves outside the checkout", async () => {
  await writeFile(join(root, "outside.txt"), "outside fixture");
  await symlink("../outside.txt", join(checkout, "first"));
  await symlink("first", join(checkout, "second"));
  await expect(assertContainedSymlinks(checkout)).rejects.toThrow(
    "outside the checkout",
  );
});

it("rejects unresolved symlinks before the coding process can use them", async () => {
  await symlink("missing", join(checkout, "unresolved"));
  await expect(assertContainedSymlinks(checkout)).rejects.toThrow(
    "unresolved symlink",
  );
});
