import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        // Vite+ owns build caching; a cache miss must emit every output file.
        command: "tsc --incremental false",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          // `auto` can't see what native tools (tsc 7, esbuild) read, so list
          // the sources explicitly or edits replay a stale build.
          input: [
            { auto: true },
            { pattern: "branding/**", base: "workspace" },
            "src/**",
            "tsconfig.json",
            "package.json",
            ".env*",
            { pattern: ".env*", base: "workspace" },
            { pattern: "pnpm-lock.yaml", base: "workspace" },
          ],
          output: ["dist/**"],
        },
      },
      "test:run": {
        command:
          "vp test run --config vitest.config.ts && pnpm run test:exports && pnpm run test:previews",
        dependsOn: [
          "compile",
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
});
