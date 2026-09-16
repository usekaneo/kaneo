#!/usr/bin/env node
// Runs in semantic-release's verifyRelease step, which a dry run still executes.
import { appendFileSync } from "node:fs";

const version = process.argv[2] ?? "";

console.log(`Next release version: ${version}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
