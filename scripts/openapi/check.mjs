#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const COMMITTED = resolve("apps/docs/openapi.json");
const FIX = process.argv.includes("--fix");
const RUN = {
  stdio: ["ignore", "ignore", "inherit"],
  shell: process.platform === "win32",
};

function generate(into) {
  execFileSync("pnpm", ["turbo", "build", "--filter=@kaneo/api^..."], RUN);
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@kaneo/api",
      "exec",
      "tsx",
      "scripts/export-openapi.ts",
      into,
    ],
    RUN,
  );
}

function run() {
  const workdir = mkdtempSync(join(tmpdir(), "kaneo-openapi-"));
  const generated = join(workdir, "openapi.json");

  try {
    generate(generated);

    const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    const committed = existsSync(COMMITTED) ? read(COMMITTED) : null;
    if (committed === read(generated)) {
      console.log("apps/docs/openapi.json is up to date");
      return 0;
    }

    if (FIX) {
      copyFileSync(generated, COMMITTED);
      console.log("apps/docs/openapi.json regenerated");
      return 0;
    }

    console.error(
      `apps/docs/openapi.json is ${committed === null ? "missing" : "out of date"}.\n` +
        "The docs site serves this file, so it has to be regenerated and committed\n" +
        "whenever a route, request schema, or response schema changes.\n\n" +
        "  pnpm openapi:check:fix\n",
    );
    return 1;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

process.exitCode = run();
