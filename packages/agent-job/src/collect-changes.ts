import type { ChangedFile } from "./protocol.js";

export async function collectChanges(
  git: (args: string[]) => Promise<Buffer>,
  baseSha: string,
): Promise<ChangedFile[]> {
  await git(["read-tree", baseSha]);
  await git(["add", "-A", "--", "."]);
  const entries = (
    await git([
      "diff",
      "--cached",
      "--name-status",
      "--no-renames",
      "-z",
      baseSha,
    ])
  )
    .toString("utf8")
    .split("\0");
  const staged = (await git(["ls-files", "--stage", "-z"]))
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
    const content = await git(["cat-file", "blob", sha]);
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
}
