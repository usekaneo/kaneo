import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "next build",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
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
        cache: {
          input: [
            { auto: true },
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: [],
        },
      },
    },
  },
});
