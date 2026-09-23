#!/usr/bin/env node
import { execFileSync } from "node:child_process";
// Runs in semantic-release's verifyRelease step, which a dry run still executes.
import { appendFileSync } from "node:fs";

const version = process.argv[2] ?? "";
execFileSync(
  process.execPath,
  ["scripts/security/validate-release-version.mjs", version, "--new-version"],
  { stdio: "inherit" },
);
if (process.env.PLANNED_VERSION && process.env.PLANNED_VERSION !== version) {
  throw new Error(
    "Release version changed after image planning; refusing to create a mismatched release",
  );
}

console.log(`Next release version: ${version}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
