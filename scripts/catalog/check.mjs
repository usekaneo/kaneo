#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkPublishedPackage, readNpmView } from "./npm-checks.mjs";
import { validateCatalog } from "./validate.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const INDEX = path.join(repoRoot, "catalog", "index.json");
const REMOTE = process.argv.includes("--remote");
const runFile = promisify(execFile);

async function npmView(packageName) {
  try {
    const { stdout } = await runFile("npm", ["view", packageName, "--json"], {
      shell: process.platform === "win32",
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return readNpmView(stdout);
  } catch (error) {
    return readNpmView(error.stdout ?? "", error.message);
  }
}

function countLabel(count) {
  return `${count} ${count === 1 ? "plugin" : "plugins"}`;
}

async function checkRemote(plugins) {
  if (plugins.length === 0) {
    console.log("No plugins are listed, so there is nothing to check on npm.");
    return 0;
  }

  let failed = false;
  for (const entry of plugins) {
    const result = await npmView(entry.package);
    if (result.notFound) {
      failed = true;
      console.log(`${entry.package}:\n  error: not found on npm`);
      continue;
    }
    if (result.error) {
      failed = true;
      console.log(
        `${entry.package}:\n  error: npm view failed: ${result.error}`,
      );
      continue;
    }

    const { errors, warnings } = checkPublishedPackage(entry, result.manifest);
    const label = `${entry.package}@${result.manifest.version}`;
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`${label}: OK`);
      continue;
    }
    failed ||= errors.length > 0;
    console.log(`${label}:`);
    for (const error of errors) console.log(`  error: ${error}`);
    for (const warning of warnings) console.log(`  warning: ${warning}`);
  }

  if (failed) {
    console.error(
      "\nA listed package does not meet the requirements in catalog/README.md.",
    );
    return 1;
  }
  return 0;
}

async function run() {
  let catalog;
  try {
    catalog = JSON.parse(await readFile(INDEX, "utf8"));
  } catch (error) {
    console.error(`catalog/index.json could not be read: ${error.message}`);
    return 1;
  }

  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    console.error("catalog/index.json has problems:");
    for (const error of errors) console.error(`  - ${error}`);
    console.error("\nSee catalog/README.md for the entry format.");
    return 1;
  }
  console.log(
    `catalog/index.json is valid (${countLabel(catalog.plugins.length)} listed)`,
  );

  return REMOTE ? checkRemote(catalog.plugins) : 0;
}

process.exitCode = await run();
