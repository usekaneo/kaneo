import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { git } from "./git.js";
import { prepareChangeCollector } from "./prepare-change-collector.js";

let root: string;
let cwd: string;
let collector: Awaited<ReturnType<typeof prepareChangeCollector>> | undefined;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "kaneo-collector-test-"));
  cwd = join(root, "checkout");
  await mkdir(cwd);
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.name", "Test"]);
  await git(cwd, ["config", "user.email", "test@example.com"]);
  await writeFile(join(cwd, "file.txt"), "original");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "initial"]);
  const baseSha = (await git(cwd, ["rev-parse", "HEAD"])).toString().trim();
  collector = await prepareChangeCollector(cwd, baseSha);
});

afterEach(async () => {
  await collector?.dispose();
  collector = undefined;
  await rm(root, { recursive: true, force: true });
});

it("ignores an agent-written fsmonitor command", async () => {
  const marker = join(root, "fsmonitor-executed");
  const script = join(cwd, ".git", "monitor.sh");
  await writeFile(
    script,
    `#!/bin/sh\ntouch '${marker.replaceAll("'", "'\\''")}'\nprintf 'token\\0'\n`,
    { mode: 0o700 },
  );
  await git(cwd, ["config", "core.fsmonitor", script]);
  await writeFile(join(cwd, "file.txt"), "changed");
  expect(await collector!.collect()).toEqual([
    {
      action: "upsert",
      path: "file.txt",
      mode: "100644",
      content: "Y2hhbmdlZA==",
    },
  ]);
  expect(existsSync(marker)).toBe(false);
});

it("pins the worktree despite agent-written core.worktree redirects", async () => {
  const outside = join(root, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "host-only.txt"), "host-only fixture");
  await git(cwd, ["config", "core.worktree", outside]);
  await writeFile(join(cwd, "file.txt"), "changed");
  expect(await collector!.collect()).toEqual([
    {
      action: "upsert",
      path: "file.txt",
      mode: "100644",
      content: "Y2hhbmdlZA==",
    },
  ]);
});

it("keeps independent base objects when the agent replaces the checkout metadata", async () => {
  await rm(join(cwd, ".git"), { recursive: true });
  await mkdir(join(cwd, ".git"));
  await writeFile(join(cwd, ".git", "config"), "invalid Git config\n");
  await writeFile(join(cwd, "file.txt"), "changed");
  expect(await collector!.collect()).toEqual([
    {
      action: "upsert",
      path: "file.txt",
      mode: "100644",
      content: "Y2hhbmdlZA==",
    },
  ]);
});

it("rejects symlinks to files outside the checkout", async () => {
  const outside = join(root, "host-only.txt");
  await writeFile(outside, "host-only fixture");
  await symlink(outside, join(cwd, "leak.txt"));
  await expect(collector!.collect()).rejects.toThrow("outside the checkout");
});
