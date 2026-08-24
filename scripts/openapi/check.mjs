#!/usr/bin/env node
// apps/docs/openapi.json is a committed artifact that Mintlify serves as the API
// reference, so it only stays truthful if something regenerates it. This fails
// when the committed document no longer matches what the routes produce.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const COMMITTED = resolve("apps/docs/openapi.json");
const FIX = process.argv.includes("--fix");

const workdir = mkdtempSync(join(tmpdir(), "kaneo-openapi-"));
const generated = join(workdir, "openapi.json");

try {
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@kaneo/api",
      "exec",
      "tsx",
      "scripts/export-openapi.ts",
      generated,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  if (readFileSync(COMMITTED, "utf8") === readFileSync(generated, "utf8")) {
    console.log("apps/docs/openapi.json is up to date");
    process.exit(0);
  }

  if (FIX) {
    copyFileSync(generated, COMMITTED);
    console.log("apps/docs/openapi.json regenerated");
    process.exit(0);
  }

  console.error(
    "apps/docs/openapi.json is out of date with the API routes.\n" +
      "The docs site serves this file, so it has to be regenerated and committed\n" +
      "whenever a route, request schema, or response schema changes.\n\n" +
      "  pnpm openapi:check:fix\n",
  );
  process.exit(1);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
