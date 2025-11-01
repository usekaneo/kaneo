import { sendMagicLinkEmail, sendWorkspaceInvitationEmail } from "@kaneo/email";
import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  anonymous,
  createAuthMiddleware,
  lastLoginMethod,
  magicLink,
  organization,
} from "better-auth/plugins";
import { config } from "dotenv-mono";
import { eq } from "drizzle-orm";
import db, { schema } from "./database";
import { publishEvent } from "./events";
import { generateDemoName } from "./utils/generate-demo-name";

config();

const apiUrl = process.env.KANEO_API_URL || "http://localhost:1337";
const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
const isHttps = apiUrl.startsWith("https://");
const isCrossSubdomain = (() => {
  try {
    const apiHost = new URL(apiUrl).hostname;
    const clientHost = new URL(clientUrl).hostname;
    return (
      apiHost !== clientHost &&
      apiHost !== "localhost" &&
      clientHost !== "localhost"
    );
  } catch {
    return false;
  }
})();

export const auth = betterAuth({
  baseURL: apiUrl,
  trustedOrigins: [clientUrl],
  secret: process.env.AUTH_SECRET || "",
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
      workspace: schema.workspaceTable,
      workspace_member: schema.workspaceUserTable,
      invitation: schema.invitationTable,
      team: schema.teamTable,
      teamMember: schema.teamMemberTable,
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
      scope: ["user:email"],
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [
    anonymous({
      generateName: async () => generateDemoName(),
      emailDomainName: "kaneo.com",
    }),
    lastLoginMethod(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          await sendMagicLinkEmail(email, "Login for Kaneo", {
            magicLink: url,
          });
        } catch (error) {
          console.error(error);
        }
      },
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
            // in metadata
            description: {
              type: "string",
              input: true,
              required: false,
            },
          },
        },
        member: {
          modelName: "workspace_member",
          fields: {
            organizationId: "workspaceId",
            createdAt: "joinedAt",
          },
        },
        invitation: {
          modelName: "invitation",
          fields: {
            organizationId: "workspaceId",
          },
        },
        team: {
          modelName: "team",
          fields: {
            organizationId: "workspaceId",
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
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.KANEO_CLIENT_URL}/auth/accept-invitation/${data.id}`;

        await sendWorkspaceInvitationEmail(
          data.email,
          `${data.inviter.user.name} invited you to join ${data.organization.name} on Kaneo`,
          {
            inviterEmail: data.inviter.user.email,
            inviterName: data.inviter.user.name,
            workspaceName: data.organization.name,
            invitationLink: inviteLink,
            to: data.email,
          },
        );
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up") || ctx.path.startsWith("/sign-in")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          const workspaceMember = await db
            .select({ workspaceId: schema.workspaceUserTable.workspaceId })
            .from(schema.workspaceUserTable)
            .where(eq(schema.workspaceUserTable.userId, newSession.user.id))
            .limit(1);

          const activeWorkspaceId = workspaceMember[0]?.workspaceId || null;

          if (activeWorkspaceId) {
            await db
              .update(schema.sessionTable)
              .set({ activeOrganizationId: activeWorkspaceId })
              .where(eq(schema.sessionTable.id, newSession.session.id));
          }
        }
      }
    }),
  },
  advanced: {
    defaultCookieAttributes: {
      // For cross-subdomain auth with HTTPS, use sameSite: "none" with secure: true
      // For same-domain or HTTP deployments, use sameSite: "lax" with secure: false
      sameSite: isCrossSubdomain && isHttps ? "none" : "lax",
      secure: isCrossSubdomain && isHttps, // must be true when sameSite is "none"
      partitioned: isCrossSubdomain && isHttps,
      domain: process.env.COOKIE_DOMAIN || undefined, // Optional: e.g., ".andrej.com" for explicit cross-subdomain cookies
    },
  },
});
