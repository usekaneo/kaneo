import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, organization } from "better-auth/plugins";
import db, { schema } from "./database";
import { generateDemoName } from "./utils/generate-demo-name";

import dotenv from "dotenv";
import { publishEvent } from "./events";

dotenv.config();

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:1337",
  trustedOrigins: ["http://localhost:5173"], // TODO: Add production URL
  secret: process.env.JWT_ACCESS_SECRET || "",
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
    organization({
      // creatorRole: "admin", // maybe will want this "The role of the user who creates the organization."
      // invitationLimit and other fields like this may be beneficial as well
      teams: {
        enabled: true,
        maximumTeams: 10,
        allowRemovingAllTeams: false,
      },
      schema: {
        organization: {
          modelName: "workspace",
          additionalFields: {
            description: {
              type: "string",
              input: true,
              required: false,
            },
            // platformAccounts: {
            //   type: "string", // JSON string
            //   input: true,
            //   required: false,
            // },
          },
        },
        member: {
          modelName: "workspace_member",
          fields: {
            organizationId: "workspace_id",
            createdAt: "joined_at",
          },
        },
        invitation: {
          fields: {
            organizationId: "workspace_id",
          },
        },
        session: {
          fields: {
            activeOrganizationId: "active_workspace_id",
          },
        },
      },
      organizationCreation: {
        disabled: false,
        afterCreate: async ({ organization, user }) => {
          publishEvent("workspace.created", {
            workspaceId: organization.id,
            workspaceName: organization.name,
            ownerEmail: user.name,
          });
        },
      },
    }),
  ],
});
