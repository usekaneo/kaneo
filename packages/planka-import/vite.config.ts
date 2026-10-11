import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts" },
    format: "esm",
    platform: "node",
    target: "node20",
    outDir: "dist",
    clean: true,
    dts: false,
    fixedExtension: false,
    report: false,
    deps: {
      onlyBundle: [],
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
          // `auto` can't see what native tools (tsc 7, esbuild) read, so list
          // the sources explicitly or edits replay a stale build.
          input: [
            { auto: true },
            "src/**",
            "tsconfig.json",
            {
              pattern: "packages/typescript-config/base.json",
              base: "workspace",
            },
            "package.json",
            { pattern: "packages/importers/dist/**", base: "workspace" },
            ".env*",
            { pattern: ".env*", base: "workspace" },
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
