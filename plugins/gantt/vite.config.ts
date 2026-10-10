import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

const buildDependencies = {
  task: "build",
  from: ["dependencies", "devDependencies"],
} as const;

export default defineConfig({
  plugins: [tailwindcss()],
  run: {
    tasks: {
      compile: {
        command: "kaneo-plugin build --human",
        dependsOn: [buildDependencies],
        cache: {
          input: [
            "src/**",
            "package.json",
            "tsconfig.json",
            "vite.config.ts",
            { pattern: "pnpm-lock.yaml", base: "workspace" },
          ],
          output: ["dist/**"],
        },
      },
      "check:types": {
        command: "tsc -p tsconfig.json --noEmit",
        dependsOn: [buildDependencies],
        cache: false,
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [buildDependencies],
        cache: false,
      },
    },
  },
});
