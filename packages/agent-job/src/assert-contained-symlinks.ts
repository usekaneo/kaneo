import { readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

// Tool path checks alone do not prevent following a checkout symlink outside it.
export async function assertContainedSymlinks(cwd: string) {
  const root = await realpath(cwd);
  const directories = [root];
  while (directories.length) {
    const directory = directories.pop()!;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        let target: string;
        try {
          target = await realpath(path);
        } catch {
          throw new Error("Repository contains an unresolved symlink");
        }
        const destination = relative(root, target);
        if (
          isAbsolute(destination) ||
          destination === ".." ||
          destination.startsWith(`..${sep}`)
        )
          throw new Error("Repository symlink points outside the checkout");
      } else if (entry.isDirectory()) {
        directories.push(path);
      }
    }
  }
}
