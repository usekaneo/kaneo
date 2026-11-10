import { brandMarkdown } from "./markdown.mjs";
import { isOmittedDoc, brandDocsConfig } from "./docs-config.mjs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeCacheOutput } from "./assets.mjs";
import { packageOutput } from "./package-output.mjs";
import { brandResources } from "../../branding/index.cjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

// Output is isolated; never rewrite the upstream docs source tree.
export async function prepareDocs(
  output = path.join(root, ".cache/branded-docs"),
) {
  const targetDirectory = await safeCacheOutput(output);
  await rm(targetDirectory, { recursive: true, force: true });
  async function copy(dir, relative = "") {
    await mkdir(path.join(targetDirectory, relative), { recursive: true });
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (
        isOmittedDoc(
          name
            .split(path.sep)
            .join("/")
            .replace(/\.mdx$/, ""),
        )
      )
        continue;
      if (entry.isDirectory()) await copy(path.join(dir, entry.name), name);
      else if (entry.isFile()) {
        const source = path.join(dir, entry.name);
        const target = path.join(targetDirectory, name);
        if (/\.(mdx?|json|svg)$/.test(name)) {
          const text = await readFile(source, "utf8");
          await writeFile(
            target,
            name.endsWith(".json")
              ? JSON.stringify(
                  name === "docs.json"
                    ? brandDocsConfig(JSON.parse(text))
                    : brandResources(JSON.parse(text)),
                  null,
                  2,
                ) + "\n"
              : brandMarkdown(text),
          );
        } else await copyFile(source, target);
      }
    }
  }
  await copy(path.join(root, "apps/docs"));
  await packageOutput("apps/docs", path.relative(root, targetDirectory));
  return targetDirectory;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "docs") throw new Error("Usage: prepare.mjs docs");
  console.log(await prepareDocs());
}
