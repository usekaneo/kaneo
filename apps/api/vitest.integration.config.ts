import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/api-integration/**/*.test.ts"],
    setupFiles: ["../../tests/api-integration/setup.ts"],
    coverage: {
      enabled: false,
    },
  },
  esbuild: {
    target: "node18",
  },
});
