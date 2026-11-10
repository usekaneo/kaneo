import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  brand,
  brandResources,
  brandText,
  assertPackageBrand,
} from "../../branding/index.cjs";
import { brandMarkdown } from "./markdown.mjs";
import { root, safePath, filesUnder, safeCacheOutput } from "./assets.mjs";

export function packageMetadata(manifest) {
  const result = { ...manifest };
  if (brand.npmScope)
    result.name = result.name.replace(/^@kaneo\//, `@${brand.npmScope}/`);
  if (result.description) result.description = brandText(result.description);
  if (result.homepage) result.homepage = brandText(result.homepage);
  // Original authorship remains in the packaged license and attribution notices.
  delete result.author;
  if (result.mcpName) result.mcpName = brand.mcpRegistryName;
  if (result.repository)
    result.repository = { ...result.repository, url: brand.repositoryUrl };
  if (result.keywords)
    result.keywords = result.keywords.filter((word) => !/kaneo/i.test(word));
  delete result.devDependencies;
  delete result.scripts;
  return result;
}

export function registryMetadata(manifest) {
  const result = brandResources(manifest);
  if (brand.npmScope)
    for (const pkg of result.packages ?? [])
      if (pkg.registryType === "npm")
        pkg.identifier = pkg.identifier.replace(
          /^@kaneo\//,
          `@${brand.npmScope}/`,
        );
  return {
    ...result,
    name: brand.mcpRegistryName,
    repository: { ...manifest.repository, url: brand.repositoryUrl },
  };
}

export async function preparePackage(directory) {
  assertPackageBrand();
  const source = safePath(root, directory);
  const output = await safeCacheOutput(
    path.join(root, ".cache/npm", path.basename(source)),
  );
  const manifest = JSON.parse(
    await readFile(path.join(source, "package.json"), "utf8"),
  );
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of ["dist", "README.md", "LICENSE"]) {
    await cp(safePath(source, file), safePath(output, file), {
      recursive: true,
    });
  }
  for (const file of await filesUnder(path.join(output, "dist")))
    if (file.endsWith(".map")) await rm(file);
  await writeFile(
    path.join(output, "README.md"),
    brandMarkdown(await readFile(path.join(source, "README.md"), "utf8")),
  );
  await writeFile(
    path.join(output, "package.json"),
    JSON.stringify(packageMetadata(manifest), null, 2) + "\n",
  );
  if (path.basename(source) === "mcp") {
    const registry = registryMetadata(
      JSON.parse(await readFile(path.join(source, "server.json"), "utf8")),
    );
    await writeFile(
      path.join(output, "server.json"),
      JSON.stringify(registry, null, 2) + "\n",
    );
  }
  const { checkOutput } = await import("./check.mjs");
  const findings = await checkOutput(path.relative(root, output));
  if (findings.length)
    throw new Error(
      findings
        .map(
          (finding) =>
            `${finding.file}:${finding.line}: ${finding.rule}: ${finding.term}`,
        )
        .join("\n"),
    );
  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!/^packages\/(cli|mcp|planka-import)$/.test(process.argv[2] ?? ""))
    throw new Error(
      "Usage: prepare-package.mjs packages/{cli,mcp,planka-import}",
    );
  console.log(await preparePackage(process.argv[2]));
}
