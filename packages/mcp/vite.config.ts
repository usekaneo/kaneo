import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command:
          "node ../../scripts/branding/vendor.mjs --compile packages/mcp/dist",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
            { pattern: "scripts/branding/**", base: "workspace" },
            { pattern: "branding/**", base: "workspace" },
            "src/**",
            "tsconfig.json",
            {
              pattern: "packages/typescript-config/base.json",
              base: "workspace",
            },
            ".env*",
            { pattern: ".env*", base: "workspace" },
            "package.json",
            { pattern: "pnpm-lock.yaml", base: "workspace" },
          ],
          output: ["dist/**"],
        },
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
