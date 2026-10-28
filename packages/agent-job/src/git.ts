import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ChangedFile } from "./protocol.js";

const exec = promisify(execFile);
function gitEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  };
}
export async function git(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = gitEnvironment(),
) {
  return (
    await exec("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd,
      env,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30000,
    })
  ).stdout;
}
export async function collectChanges(
  cwd: string,
  baseSha: string,
): Promise<ChangedFile[]> {
  const temp = await mkdtemp(join(tmpdir(), "kaneo-index-"));
  const env = { ...gitEnvironment(), GIT_INDEX_FILE: join(temp, "index") };
  try {
    await git(cwd, ["read-tree", baseSha], env);
    await git(cwd, ["add", "-A", "--", "."], env);
    const entries = (
      await git(
        cwd,
        ["diff", "--cached", "--name-status", "--no-renames", "-z", baseSha],
        env,
      )
    )
      .toString("utf8")
      .split("\0");
    const staged = (await git(cwd, ["ls-files", "--stage", "-z"], env))
      .toString("utf8")
      .split("\0");
    const blobs = new Map(
      staged.filter(Boolean).map((line) => {
        const tab = line.indexOf("\t");
        return [line.slice(tab + 1), line.slice(0, tab).split(" ")];
      }),
    );
    const files: ChangedFile[] = [];
    let bytes = 0;
    for (let i = 0; i + 1 < entries.length; i += 2) {
      const status = entries[i]!;
      const path = entries[i + 1]!;
      if (files.length >= 300) throw new Error("Too many changes");
      if (status === "D") {
        files.push({ action: "delete", path });
        continue;
      }
      const [mode, sha] = blobs.get(path) ?? [];
      if (!sha || (mode !== "100644" && mode !== "100755"))
        throw new Error("Unsupported file mode");
      const content = await git(cwd, ["cat-file", "blob", sha], env);
      bytes += content.length;
      if (bytes > 10 * 1024 * 1024) throw new Error("Changeset too large");
      files.push({
        action: "upsert",
        path,
        mode,
        content: content.toString("base64"),
      });
    }
    return files;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
