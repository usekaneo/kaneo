import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { build } from "vite-plus/pack";

const outputDir = "dist/cli";
const binary = "kaneo-plugin.mjs";

await mkdir(".cache", { recursive: true });
const stagingDir = await mkdtemp(".cache/plugin-cli-");
try {
  await build({
    config: false,
    entry: { "kaneo-plugin": "src/cli/bin.ts" },
    format: "esm",
    platform: "node",
    target: "node20",
    outDir: stagingDir,
    dts: false,
    fixedExtension: true,
    minify: true,
    report: false,
    deps: {
      onlyBundle: [
        "effect",
        "@effect/platform-node",
        "@effect/platform-node-shared",
      ],
    },
  });

  // Independent workspace tasks may build the SDK concurrently. Publish
  // the checked bundle in one rename so consumers always read a complete file.
  execFileSync(process.execPath, ["--check", join(stagingDir, binary)], {
    stdio: "inherit",
  });
  await mkdir(outputDir, { recursive: true });
  await rename(join(stagingDir, binary), join(outputDir, binary));
} finally {
  await rm(stagingDir, { recursive: true, force: true });
}
