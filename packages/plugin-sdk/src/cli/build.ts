import { rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { checkOutputs } from "./check-outputs.js";
import { emitTypes } from "./emit-types.js";
import { findEntries } from "./entries.js";
import { CliError } from "./errors.js";
import { describeVite, loadVite } from "./load-vite.js";
import { log } from "./log.js";
import { readManifest } from "./manifest.js";
import { createNodeConfig } from "./node-config.js";
import { printSummary } from "./summary.js";
import { createWebConfig } from "./web-config.js";

export async function buildPlugin(root: string): Promise<void> {
  const manifest = await readManifest(root);
  const entries = findEntries(root);
  const vite = await loadVite(root);
  const flavor = describeVite(vite);
  const nodeInputs = [entries.index, entries.server]
    .filter((entry): entry is string => entry !== null)
    .map((entry) => relative(root, entry));

  await rm(join(root, "dist"), { recursive: true, force: true });

  log.step(`Building ${nodeInputs.join(" and ")} for Node`);
  await vite.build(createNodeConfig(root, entries, flavor, false));

  if (entries.web) {
    log.step(`Building ${relative(root, entries.web)} for the browser`);
    await vite.build(createWebConfig(root, entries.web, flavor, false));
  }

  log.step("Generating dist/index.d.ts");
  const typesEmitted = await emitTypes(root, entries, manifest.packageJson);

  const issues = await checkOutputs(root, manifest, entries, typesEmitted);
  for (const warning of issues.warnings) log.warn(warning);
  if (issues.errors.length > 0) {
    const list = issues.errors.map((error) => `  - ${error}`).join("\n");
    throw new CliError(
      `The build output is not a valid Kaneo plugin:\n${list}`,
    );
  }

  await printSummary(root, manifest.plugin);
}
