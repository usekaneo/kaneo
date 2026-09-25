import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/storage-integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
