import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command:
          "esbuild src/index.ts --bundle --platform=node --outdir=dist --format=esm --packages=external --external:fs --external:path --external:crypto --external:os --external:util --external:stream --external:buffer --external:events --external:url --external:querystring --external:http --external:https --external:net --external:tls --external:zlib --external:@modelcontextprotocol/sdk",
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
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: ["dist/**"],
        },
      },
      "check:types": {
        command: "tsc --noEmit -p tsconfig.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        // Typechecks read sources across the workspace and `auto` can't trace
        // tsc 7, so a cached result can be stale; always run them (like cli).
        cache: false,
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
      "test:integration:run": {
        command: "vp test run --config vitest.integration.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
});
