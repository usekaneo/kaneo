import { rename, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandManifest } from "./manifest.mjs";
import { checkAssets, checkOutput } from "./check.mjs";
import { brandInstaller } from "./installer.mjs";
import { applyAssets, digest, filesUnder, safePath, root } from "./assets.mjs";

export async function packageOutput(surface, directory) {
  const output = safePath(root, directory);
  const assetFindings = await checkAssets([surface]);
  if (assetFindings.length) throw new Error(assetFindings.join("\n"));
  await applyAssets(surface, output);
  // Static metadata only; never rewrite JavaScript bundles or user data.
  for (const file of await filesUnder(output)) {
    if (/\.(sh|ps1)$/.test(file)) {
      await writeFile(file, brandInstaller(await readFile(file, "utf8"), file));
      continue;
    }
    if (
      !file.endsWith(".webmanifest") &&
      !file.endsWith(path.join("images", "product", "manifest.json"))
    )
      continue;
    const metadata = brandManifest(
      JSON.parse(await readFile(file, "utf8")),
      surface,
    );
    await writeFile(file, JSON.stringify(metadata, null, 2) + "\n");
  }
  for (const file of await filesUnder(output)) {
    const name = path.basename(file);
    if (!name.startsWith("kaneo-")) continue;
    const target = path.join(
      path.dirname(file),
      name.replace(/^kaneo-/, "product-"),
    );
    try {
      await stat(target);
      // A cached rebuild restores the upstream name beside its earlier rename.
      if (digest(await readFile(target)) !== digest(await readFile(file)))
        throw new Error(`Asset rename collision: ${target}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(file, target);
  }
  const findings = await checkOutput(directory);
  if (findings.length)
    throw new Error(
      findings
        .map(
          (finding) =>
            `${finding.file}:${finding.line}: ${finding.rule}: ${finding.term}`,
        )
        .join("\n"),
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4)
    throw new Error("Usage: package-output.mjs surface output-directory");
  await packageOutput(process.argv[2], process.argv[3]);
}
