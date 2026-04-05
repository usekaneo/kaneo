import { apiKey } from "@better-auth/api-key";
import {
  sendMagicLinkEmail,
  sendOtpEmail,
  sendWorkspaceInvitationEmail,
} from "@kaneo/email";
import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  anonymous,
  bearer,
  deviceAuthorization,
  emailOTP,
  genericOAuth,
  lastLoginMethod,
  magicLink,
  openAPI,
  organization,
} from "better-auth/plugins";
import { config } from "dotenv-mono";
import { eq } from "drizzle-orm";
import db, { schema } from "./database";
import { publishEvent } from "./events";
import { checkRegistrationAllowed } from "./utils/check-registration-allowed";
import { generateDemoName } from "./utils/generate-demo-name";
import { getGithubSsoOAuthCredentials } from "./utils/github-sso-env";

config();

const githubSso = getGithubSsoOAuthCredentials();

const isRegistrationDisabled = process.env.DISABLE_REGISTRATION === "true";
const isPasswordRegistrationDisabled =
  process.env.DISABLE_PASSWORD_REGISTRATION === "true";

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

const trustedOrigins = [clientUrl];
try {
  const apiOrigin = new URL(apiUrl);
  const apiOriginString = `${apiOrigin.protocol}//${apiOrigin.host}`;
  if (!trustedOrigins.includes(apiOriginString)) {
    trustedOrigins.push(apiOriginString);
  }
} catch {}

const baseURLWithoutPath = (() => {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/"); // Get protocol://host
  }
})();

if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
  console.error(
    "AUTH_SECRET is less than 32 characters, please generate a new one.",
  );
  process.exit(1);
}

async function getUserLocale(email: string) {
  const [user] = await db
    .select({ locale: schema.userTable.locale })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email))
    .limit(1);

  return user?.locale ?? null;
}

function getLocaleKey(locale?: string | null) {
  return locale?.toLowerCase().startsWith("de") ? "de" : "en";
}

function getAuthEmailCopy(locale?: string | null) {
  return getLocaleKey(locale) === "de"
    ? {
        magicLinkSubject: "Anmeldelink fuer Kaneo",
        otpSubject: "Bestaetigungscode fuer Kaneo",
      }
    : {
        magicLinkSubject: "Login for Kaneo",
        otpSubject: "Authentication code for Kaneo",
      };
}

function getDeviceAuthClientIds(): Set<string> {
  const raw = process.env.DEVICE_AUTH_CLIENT_IDS?.trim();
  if (raw) {
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return new Set(["kaneo-cli"]);
}

function getDeviceAuthVerificationUri(): string {
  const base = clientUrl.replace(/\/$/, "");
  return `${base}/device`;
}

function getInvitationEmailSubject(
  locale: string | null,
  inviterName: string,
  workspaceName: string,
) {
  return getLocaleKey(locale) === "de"
    ? `${inviterName} hat dich eingeladen, ${workspaceName} auf Kaneo beizutreten`
    : `${inviterName} invited you to join ${workspaceName} on Kaneo`;
}

export const auth = betterAuth({
  baseURL: baseURLWithoutPath,
  trustedOrigins,
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
      apikey: schema.apikeyTable,
      deviceCode: schema.deviceCodeTable,
    },
  }),
  user: {
    additionalFields: {
      locale: {
        type: "string",
        input: true,
        required: false,
      },
    },
  },
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
      clientId: githubSso.clientId,
      clientSecret: githubSso.clientSecret,
      scope: ["user:email"],
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    },
  },
  plugins: [
    ...(process.env.DISABLE_GUEST_ACCESS !== "true"
      ? [
          anonymous({
            generateName: async () => generateDemoName(),
            emailDomainName: "kaneo.app",
          }),
        ]
      : []),
    lastLoginMethod(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        try {
          const locale = await getUserLocale(email);
          const copy = getAuthEmailCopy(locale);
          await sendMagicLinkEmail(email, copy.magicLinkSubject, {
            magicLink: url,
            locale,
          });
        } catch (error) {
          console.error(error);
        }
      },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in") {
          const locale = await getUserLocale(email);
          const copy = getAuthEmailCopy(locale);
          await sendOtpEmail(email, copy.otpSubject, {
            otp,
            locale,
          });
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
      allowUserToCreateOrganization: true,
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) => {
          publishEvent("workspace.created", {
            workspaceId: organization.id,
            workspaceName: organization.name,
            ownerEmail: user.name,
            ownerId: user.id,
          });
        },
      },
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.KANEO_CLIENT_URL}/invitation/accept/${data.id}`;
        const locale = await getUserLocale(data.email);

        const result = await sendWorkspaceInvitationEmail(
          data.email,
          getInvitationEmailSubject(
            locale,
            data.inviter.user.name,
            data.organization.name,
          ),
          {
            inviterEmail: data.inviter.user.email,
            inviterName: data.inviter.user.name,
            locale,
            workspaceName: data.organization.name,
            invitationLink: inviteLink,
            to: data.email,
          },
        );

        if (
          result?.success === false &&
          result.reason === "SMTP_NOT_CONFIGURED"
        ) {
          console.warn(
            "Invitation created but email not sent due to SMTP not being configured",
          );
          return;
        }
      },
    }),
    genericOAuth({
      config: [
        {
          providerId: "custom",
          clientId: process.env.CUSTOM_OAUTH_CLIENT_ID || "",
          clientSecret: process.env.CUSTOM_OAUTH_CLIENT_SECRET,
          authorizationUrl: process.env.CUSTOM_OAUTH_AUTHORIZATION_URL || "",
          tokenUrl: process.env.CUSTOM_OAUTH_TOKEN_URL || "",
          userInfoUrl: process.env.CUSTOM_OAUTH_USER_INFO_URL || "",
          scopes: process.env.CUSTOM_OAUTH_SCOPES?.split(",")
            .map((s) => s.trim())
            .filter(Boolean) || ["profile", "email"],
          responseType: process.env.CUSTOM_OAUTH_RESPONSE_TYPE || "code",
          discoveryUrl: process.env.CUSTOM_OAUTH_DISCOVERY_URL || "",
          pkce: process.env.CUSTOM_AUTH_PKCE !== "false",
        },
      ],
    }),
    bearer(),
    apiKey({
      enableSessionForAPIKeys: true,
      apiKeyHeaders: "x-api-key",
      rateLimit: {
        enabled: true,
        maxRequests: 100,
        timeWindow: 60 * 1000,
      },
    }),
    deviceAuthorization({
      verificationUri: getDeviceAuthVerificationUri(),
      validateClient: async (clientId) =>
        getDeviceAuthClientIds().has(clientId),
    }),
    openAPI(),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const result = await checkRegistrationAllowed(user.email);
          if (!result.allowed) {
            throw new APIError("FORBIDDEN", {
              message: result.reason,
            });
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const isSignUpPath =
        ctx.path === "/sign-up/email" ||
        ctx.path.startsWith("/callback/") ||
        ctx.path.startsWith("/sign-in/social");

      if (!isSignUpPath) {
        return;
      }

      if (ctx.path === "/sign-up/email") {
        if (isPasswordRegistrationDisabled) {
          throw new APIError("FORBIDDEN", {
            message:
              "Password registration is currently disabled. Please use a configured social or OIDC sign-in method.",
          });
        }
      }

      if (!isRegistrationDisabled) {
        return;
      }

      const email =
        ctx.body?.email ||
        ctx.query?.email ||
        ctx.headers?.get("x-invitation-email");
      const invitationId =
        ctx.body?.invitationId ||
        ctx.query?.invitationId ||
        ctx.headers?.get("x-invitation-id");

      if (ctx.path === "/sign-up/email") {
        const result = await checkRegistrationAllowed(email, invitationId);
        if (!result.allowed) {
          throw new APIError("FORBIDDEN", {
            message: result.reason,
          });
        }
      }
    }),
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
