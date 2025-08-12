import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import db from "./database";
import { generateDemoName } from "./utils/generate-demo-name";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    anonymous({
      generateName: async () => generateDemoName(),
    }),
  ],
});
