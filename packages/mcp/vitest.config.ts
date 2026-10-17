import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
