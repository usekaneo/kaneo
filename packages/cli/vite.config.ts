import { defineConfig } from "vite-plus";
import { brandCopyPlugin } from "../../scripts/branding/source.mjs";

export default defineConfig({
  pack: {
    plugins: [brandCopyPlugin()],
    entry: { kaneo: "src/bin.ts" },
    format: "esm",
    platform: "node",
    target: "node20",
    outDir: "dist",
    clean: true,
    dts: false,
    fixedExtension: true,
    minify: true,
    report: false,
    deps: {
      onlyBundle: [
        "@kaneo/branding",
        "effect",
        "@effect/platform-node",
        "@effect/platform-node-shared",
        "@kaneo/mcp",
        "@gabrielbryk/jq-ts",
        "pngjs",
        "jpeg-js",
      ],
    },
  },
  run: {
    tasks: {
      compile: {
        command: "vp pack",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
            { pattern: "branding/**", base: "workspace" },
            { pattern: "scripts/branding/**", base: "workspace" },
            "src/**",
            "tsconfig.json",
            {
              pattern: "packages/typescript-config/base.json",
              base: "workspace",
            },
            "package.json",
            { pattern: "pnpm-lock.yaml", base: "workspace" },
          ],
          output: ["dist/**"],
        },
      },
      "check:types": {
        command: "tsc -p tsconfig.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
});
