import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { filesUnder, root, safePath } from "./assets.mjs";
import { foldBrandCalls, syntax, walk } from "./source.mjs";

// Published packages cannot require a private workspace module at runtime.
export async function vendorBrand(directory) {
  const output = safePath(root, directory);
  const target = path.join(output, "fork-branding");
  await mkdir(target, { recursive: true });
  for (const file of ["index.cjs", "config.json"])
    await copyFile(path.join(root, "branding", file), path.join(target, file));
  await copyFile(
    path.join(root, "branding/index.d.ts"),
    path.join(target, "index.d.cts"),
  );
  for (const file of await filesUnder(output)) {
    if (!/\.[cm]?js$/.test(file) || file.startsWith(target + path.sep))
      continue;
    let source = foldBrandCalls(await readFile(file, "utf8"), file);
    const edits = [];
    walk(syntax(source, file), (node, parent) => {
      if (
        node.type !== "StringLiteral" ||
        node.value !== "@kaneo/branding" ||
        !/^(Import|Export)/.test(parent?.type)
      )
        return;
      let relative = path
        .relative(path.dirname(file), path.join(target, "index.cjs"))
        .split(path.sep)
        .join("/");
      if (!relative.startsWith(".")) relative = "./" + relative;
      edits.push({
        start: node.start,
        end: node.end,
        text: JSON.stringify(relative),
      });
    });
    for (const edit of edits.sort((a, b) => b.start - a.start))
      source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    if (edits.length) await writeFile(file, source);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const compile = process.argv[2] === "--compile";
  const directory = process.argv[compile ? 3 : 2];
  if (!directory)
    throw new Error("Usage: vendor.mjs [--compile] output-directory");
  // Keep emission and vendoring in one task: a restored tsc cache can contain already-vendored files.
  if (compile)
    execFileSync(
      "pnpm",
      ["exec", "tsc", "--incremental", "false", "-p", "tsconfig.json"],
      { stdio: "inherit" },
    );
  await vendorBrand(directory);
}
