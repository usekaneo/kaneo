import { type Config, defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/database/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:kaneo.db",
  },
}) satisfies Config;
