import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
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
          input: [{ auto: true }, "src/**", "tsconfig.json", "package.json"],
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
