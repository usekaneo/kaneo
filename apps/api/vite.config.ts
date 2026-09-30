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
          input: [
            { auto: true },
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
        cache: {
          input: [
            { auto: true },
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: [],
        },
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
