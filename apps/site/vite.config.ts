import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command:
          "next build && node ../../scripts/branding/package-output.mjs apps/site/public apps/site/out",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
            { pattern: "branding/**", base: "workspace" },
            { pattern: "scripts/branding/**", base: "workspace" },
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: [".next/**", "!.next/cache/**", "out/**"],
          env: ["NEXT_PUBLIC_*", "NODE_ENV"],
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
    },
  },
});
