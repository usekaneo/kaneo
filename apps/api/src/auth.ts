import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import db, { schema } from "./database";
import { generateDemoName } from "./utils/generate-demo-name";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:1337",
  trustedOrigins: ["http://localhost:5173"],
  // biome-ignore lint/style/noNonNullAssertion:
  secret: process.env.JWT_ACCESS!,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
    },
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
