import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { "kaneo-plugin": "src/cli/bin.ts" },
    format: "esm",
    platform: "node",
    target: "node20",
    outDir: "dist/cli",
    clean: true,
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
  },
  run: {
    tasks: {
      compile: {
        command: "vp pack",
        dependsOn: [
          "compile:lib",
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
            "src/**",
            "tsconfig.json",
            {
              pattern: "packages/typescript-config/base.json",
              base: "workspace",
            },
            "package.json",
            { pattern: "pnpm-lock.yaml", base: "workspace" },
          ],
          output: ["dist/cli/**"],
        },
      },
      "compile:lib": {
        command: "tsc -p tsconfig.build.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            "src/**",
            "tsconfig.build.json",
            {
              pattern: "packages/typescript-config/base.json",
              base: "workspace",
            },
            "package.json",
            { pattern: "pnpm-lock.yaml", base: "workspace" },
          ],
          output: ["dist/**", "!dist/cli/**"],
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
