import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "node scripts/build-cli.mjs",
        dependsOn: [
          "compile:lib",
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
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
