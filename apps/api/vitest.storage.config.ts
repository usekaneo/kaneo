import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/storage-integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
