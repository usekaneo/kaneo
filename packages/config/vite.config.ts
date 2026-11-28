import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "tsc -p tsconfig.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: ["src/**", "tsconfig.json", "package.json"],
          output: ["dist/**"],
        },
      },
    },
  },
});
