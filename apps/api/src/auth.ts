import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, lastLoginMethod } from "better-auth/plugins";
import db, { schema } from "./database";
import { generateDemoName } from "./utils/generate-demo-name";

import dotenv from "dotenv";

dotenv.config();

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  baseURL: process.env.KANEO_API_URL || "http://localhost:1337",
  trustedOrigins: [process.env.KANEO_CLIENT_URL || "http://localhost:5173"],
  secret: process.env.AUTH_SECRET || "",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ hash, password }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scopes: ["user:email"],
    },
  },
  plugins: [
    anonymous({
      generateName: async () => generateDemoName(),
    }),
    lastLoginMethod(),
  ],
});
