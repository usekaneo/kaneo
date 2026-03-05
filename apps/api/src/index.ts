import { serve } from "@hono/node-server";
import type { Session, User } from "better-auth/types";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { openAPIRouteHandler } from "hono-openapi";
import activity from "./activity";
import { auth } from "./auth";
import column from "./column";
import config from "./config";
import db from "./database";
import externalLink from "./external-link";
import githubIntegration, {
  handleGithubWebhookRoute,
} from "./github-integration";
import invitation from "./invitation";
import label from "./label";
import { migrateColumns } from "./migrations/column-migration";
import notification from "./notification";
import { initializePlugins } from "./plugins";
import { migrateGitHubIntegration } from "./plugins/github/migration";
import project from "./project";
import { getPublicProject } from "./project/controllers/get-public-project";
import search from "./search";
import task from "./task";
import timeEntry from "./time-entry";
import { getInvitationDetails } from "./utils/check-registration-allowed";
import { migrateApiKeyReferenceId } from "./utils/migrate-apikey-reference-id";
import { migrateSessionColumn } from "./utils/migrate-session-column";
import { migrateWorkspaceUserEmail } from "./utils/migrate-workspace-user-email";
import {
  dedupeOperationIds,
  ensureOperationSummaries,
  mergeOpenApiSpecs,
  normalizeApiServerUrl,
  normalizeEmptyRequiredArrays,
  normalizeNullableSchemasForOpenApi30,
  normalizeOrganizationAuthOperations,
} from "./utils/openapi-spec";
import { verifyApiKey } from "./utils/verify-api-key";
import workflowRule from "./workflow-rule";

type ApiKey = {
  id: string;
  userId: string;
  enabled: boolean;
};

const app = new Hono<{
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
    apiKey?: ApiKey;
  };
}>();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : undefined;

app.use(
  "*",
  cors({
    credentials: true,
    origin: (origin) => {
      if (!corsOrigins) {
        return origin || "*";
      }

      if (!origin) {
        return null;
      }

      return corsOrigins.includes(origin) ? origin : null;
    },
  }),
);

const api = new Hono<{
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
    userEmail: string;
    apiKey?: ApiKey;
  };
}>();

api.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const publicProjectApi = api.get("/public-project/:id", async (c) => {
  const { id } = c.req.param();
  const project = await getPublicProject(id);

  return c.json(project);
});

api.post("/github-integration/webhook", handleGithubWebhookRoute);

const invitationPublicApi = api.get("/invitation/public/:id", async (c) => {
  const { id } = c.req.param();
  const result = await getInvitationDetails(id);
  return c.json(result);
});

const configApi = api.route("/config", config);

const honoOpenApiHandler = openAPIRouteHandler(api, {
  documentation: {
    openapi: "3.0.3",
    info: {
      title: "Kaneo API",
      version: "1.0.0",
      description:
        "Kaneo Project Management API - Manage projects, tasks, labels, and more",
    },
    servers: [
      {
        url: normalizeApiServerUrl(
          process.env.KANEO_API_URL || "https://cloud.kaneo.app",
        ),
        description: "Kaneo API Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API Key authentication",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
});

api.get("/openapi", async (c) => {
  const maybeResponse = await honoOpenApiHandler(c, async () => {});
  const honoSpecResponse = maybeResponse ?? c.res;
  const honoSpec = (await honoSpecResponse.json()) as Record<string, unknown>;

  let authSpec: Record<string, unknown> = {};
  try {
    authSpec = (await auth.api.generateOpenAPISchema()) as Record<
      string,
      unknown
    >;
  } catch (error) {
    console.error("Failed to generate Better Auth OpenAPI schema:", error);
  }

  const normalizedAuthSpec = normalizeOrganizationAuthOperations(authSpec);
  return c.json(
    ensureOperationSummaries(
      dedupeOperationIds(
        normalizeNullableSchemasForOpenApi30(
          normalizeEmptyRequiredArrays(
            mergeOpenApiSpecs(honoSpec, normalizedAuthSpec),
          ),
        ),
      ),
    ),
  );
});

api.on(["POST", "GET", "PUT", "DELETE"], "/auth/*", (c) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.substring(7).replace(/\s+/g, "").trim();
    const headers = new Headers(c.req.raw.headers);

    // Better Auth API key plugin validates from x-api-key by default.
    if (!headers.get("x-api-key")) {
      headers.set("x-api-key", apiKey);
    }

    return auth.handler(
      new Request(c.req.raw, {
        headers,
      }),
    );
  }

  return auth.handler(c.req.raw);
});

api.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.substring(7).replace(/\s+/g, "").trim();

    try {
      const result = await verifyApiKey(apiKey);

      if (result?.valid && result.key) {
        c.set("userId", result.key.userId);
        c.set("user", null);
        c.set("session", null);
        c.set("apiKey", {
          id: result.key.id,
          userId: result.key.userId,
          enabled: result.key.enabled,
        });
        return next();
      }

      throw new HTTPException(401, { message: "Invalid API key" });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error("API key verification failed:", error);
      throw new HTTPException(401, { message: "API key verification failed" });
    }
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user || null);
  c.set("session", session?.session || null);
  c.set("userId", session?.user?.id || "");
  c.set("userEmail", session?.user?.email || "");

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return next();
});

const projectApi = api.route("/project", project);
const taskApi = api.route("/task", task);
const columnApi = api.route("/column", column);
const activityApi = api.route("/activity", activity);
const timeEntryApi = api.route("/time-entry", timeEntry);
const labelApi = api.route("/label", label);
const notificationApi = api.route("/notification", notification);
const searchApi = api.route("/search", search);
const githubIntegrationApi = api.route(
  "/github-integration",
  githubIntegration,
);
const externalLinkApi = api.route("/external-link", externalLink);
const workflowRuleApi = api.route("/workflow-rule", workflowRule);
const invitationApi = api.route("/invitation", invitation);

app.route("/api", api);

(async () => {
  try {
    await migrateWorkspaceUserEmail();
    await migrateSessionColumn();
    await migrateApiKeyReferenceId();

    console.log("🔄 Migrating database...");
    await migrate(db, {
      migrationsFolder: `${process.cwd()}/drizzle`,
    });
    console.log("✅ Database migrated successfully!");

    await migrateGitHubIntegration();
    await migrateColumns();

    initializePlugins();
  } catch (error) {
    console.error("❌ Database migration failed!", error);
    process.exit(1);
  }
})();

serve(
  {
    fetch: app.fetch,
    port: 1337,
  },
  () => {
    console.log(
      `⚡ API is running at ${process.env.KANEO_API_URL || "http://localhost:1337"}`,
    );
  },
);

export type AppType =
  | typeof configApi
  | typeof projectApi
  | typeof taskApi
  | typeof columnApi
  | typeof activityApi
  | typeof timeEntryApi
  | typeof labelApi
  | typeof notificationApi
  | typeof searchApi
  | typeof githubIntegrationApi
  | typeof externalLinkApi
  | typeof workflowRuleApi
  | typeof invitationApi
  | typeof publicProjectApi
  | typeof invitationPublicApi;

export default app;
