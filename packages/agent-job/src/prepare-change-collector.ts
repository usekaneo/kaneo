import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectChanges } from "./collect-changes.js";
import { git } from "./git.js";
import { assertContainedSymlinks } from "./assert-contained-symlinks.js";

/** Prepare before the agent can edit .git; never reuse its config or objects. */
export async function prepareChangeCollector(cwd: string, baseSha: string) {
  const worktree = await realpath(cwd);
  await assertContainedSymlinks(worktree);
  const temp = await mkdtemp(join(tmpdir(), "kaneo-collector-"));
  const gitDir = join(temp, "repository.git");
  const dispose = () => rm(temp, { recursive: true, force: true });
  const trustedGit = (args: string[]) =>
    git(worktree, [
      `--git-dir=${gitDir}`,
      `--work-tree=${worktree}`,
      "-c",
      "core.bare=false",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.attributesFile=/dev/null",
      "-c",
      "core.excludesFile=/dev/null",
      ...args,
    ]);
  try {
    await git(temp, ["init", "--bare", "--template=", gitDir]);
    // Fetch copies the approved tree into an independent object store. Local
    // clone optimizations (hardlinks/alternates) would leave it agent-writable.
    await trustedGit([
      "fetch",
      "--depth=1",
      "--no-tags",
      "--no-recurse-submodules",
      "--no-auto-maintenance",
      worktree,
      baseSha,
    ]);
    return {
      collect: async () => {
        await assertContainedSymlinks(worktree);
        return collectChanges(trustedGit, baseSha);
      },
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
