import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import type { Session, User } from "better-auth/types";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import {
  describeRoute,
  openAPIRouteHandler,
  resolver,
  validator,
} from "hono-openapi";
import * as v from "valibot";
import activity from "./activity";
import { auth } from "./auth";
import column from "./column";
import comment from "./comment";
import config from "./config";
import db, { schema } from "./database";
import discordIntegration from "./discord-integration";
import externalLink from "./external-link";
import genericWebhookIntegration from "./generic-webhook-integration";
import giteaIntegration, { handleGiteaWebhookRoute } from "./gitea-integration";
import githubIntegration, {
  handleGithubWebhookRoute,
} from "./github-integration";
import invitation from "./invitation";
import label from "./label";
import mcpRoutes, { mcpWellKnownRoutes } from "./mcp";
import { migrateColumns } from "./migrations/column-migration";
import notification from "./notification";
import notificationPreferences from "./notification-preferences";
import { initializePlugins } from "./plugins";
import { migrateGitHubIntegration } from "./plugins/github/migration";
import project from "./project";
import { getPublicProject } from "./project/controllers/get-public-project";
import { initializeScheduler, shutdownScheduler } from "./scheduler";
import search from "./search";
import slackIntegration from "./slack-integration";
import { getPrivateObject } from "./storage/s3";
import task from "./task";
import taskRelation from "./task-relation";
import telegramIntegration from "./telegram-integration";
import timeEntry from "./time-entry";
import {
  authenticateApiRequest,
  resolveAssetBearerOrCookie,
} from "./utils/authenticate-api-request";
import { getInvitationDetails } from "./utils/check-registration-allowed";
import { migrateApiKeyReferenceId } from "./utils/migrate-apikey-reference-id";
import { migrateNotificationPreferencesSchema } from "./utils/migrate-notification-preferences-schema";
import { migrateSessionColumn } from "./utils/migrate-session-column";
import { migrateWorkspaceUserEmail } from "./utils/migrate-workspace-user-email";
import {
  dedupeOperationIds,
  ensureOperationSummaries,
  markOptionalSchemaFieldsNullable,
  mergeOpenApiSpecs,
  normalizeApiServerUrl,
  normalizeEmptyAndEnumSchemas,
  normalizeEmptyRequiredArrays,
  normalizeNullableSchemasForOpenApi30,
  normalizeOrganizationAuthOperations,
} from "./utils/openapi-spec";
import { validateWorkspaceAccess } from "./utils/validate-workspace-access";
import workflowRule from "./workflow-rule";
import workspace from "./workspace";

type ApiKey = {
  id: string;
  userId: string;
  enabled: boolean;
};

type AppVariables = {
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
    apiKey?: ApiKey;
  };
};

type ApiVariables = {
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
    userEmail: string;
    apiKey?: ApiKey;
  };
};

function buildContentDisposition(filename: string) {
  const normalized = filename
    .normalize("NFC")
    .replace(/[\r\n"]/g, "")
    .trim();
  const safeFilename = normalized || "file";
  const asciiFallback =
    safeFilename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/]/g, "-")
      .replace(/[^\x20-\u7E]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "file";
  const encodedFilename = encodeURIComponent(safeFilename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

export function createApp() {
  const app = new Hono<AppVariables>();
  const corsOriginSource = [process.env.CORS_ORIGINS, process.env.KANEO_CLIENT_URL].find(
    (value) => value?.trim(),
  );
  const corsOrigins = corsOriginSource
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

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

  const api = new Hono<ApiVariables>();

  api.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  const publicProjectApi = api.get("/public-project/:id", async (c) => {
    const { id } = c.req.param();
    const project = await getPublicProject(id);

    return c.json(project);
  });

  api.post("/github-integration/webhook", handleGithubWebhookRoute);

  api.post(
    "/gitea-integration/webhook/:integrationId",
    handleGiteaWebhookRoute,
  );

  const invitationPublicApi = api.get("/invitation/public/:id", async (c) => {
    const { id } = c.req.param();
    const result = await getInvitationDetails(id);
    return c.json(result);
  });

  api.get(
    "/auth/get-session",
    describeRoute({
      operationId: "getSession",
      tags: ["Authentication"],
      description: "Get the current authenticated session",
      security: [],
      responses: {
        200: {
          description: "Current session details or null when unauthenticated",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      return c.json(session ?? null);
    },
  );

  api.get(
    "/asset/:id",
    describeRoute({
      operationId: "getAsset",
      tags: ["Assets"],
      description: "Download an uploaded asset by ID",
      security: [],
      responses: {
        200: {
          description: "The requested asset binary stream",
          content: {
            "*/*": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.param();
      const [asset] = await db
        .select({
          id: schema.assetTable.id,
          objectKey: schema.assetTable.objectKey,
          mimeType: schema.assetTable.mimeType,
          filename: schema.assetTable.filename,
          workspaceId: schema.assetTable.workspaceId,
          isPublic: schema.projectTable.isPublic,
        })
        .from(schema.assetTable)
        .innerJoin(
          schema.projectTable,
          eq(schema.assetTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.assetTable.id, id))
        .limit(1);

      if (!asset) {
        throw new HTTPException(404, { message: "Asset not found" });
      }

      const { userId, apiKeyId } = await resolveAssetBearerOrCookie(c);

      if (userId) {
        await validateWorkspaceAccess(userId, asset.workspaceId, apiKeyId);
      } else if (!asset.isPublic) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }

      try {
        const object = await getPrivateObject(asset.objectKey);

        return new Response(object.body as BodyInit, {
          headers: {
            "Cache-Control": asset.isPublic
              ? "public, max-age=300"
              : "private, max-age=120",
            "Content-Disposition": buildContentDisposition(asset.filename),
            "Content-Length": object.contentLength?.toString() || "",
            "Content-Type": object.contentType || asset.mimeType,
            ETag: object.etag || "",
            "Last-Modified": object.lastModified?.toUTCString() || "",
          },
        });
      } catch (error) {
        console.error("Failed to stream asset:", error);
        throw new HTTPException(404, { message: "Asset object not found" });
      }
    },
  );

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
            description: "API key or session token (Bearer)",
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
          markOptionalSchemaFieldsNullable(
            normalizeNullableSchemasForOpenApi30(
              normalizeEmptyAndEnumSchemas(
                normalizeEmptyRequiredArrays(
                  mergeOpenApiSpecs(honoSpec, normalizedAuthSpec),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });

  // Better Auth serves GET /auth/device as JSON. Browsers that open the API URL
  // directly expect a page — redirect full document navigations to the web app.
  const authDeviceQuerySchema = v.object({
    user_code: v.optional(v.string()),
    ui: v.optional(v.picklist(["1"])),
  });

  api.get(
    "/auth/device",
    describeRoute({
      operationId: "getDeviceAuthorizationPage",
      tags: ["Authentication"],
      description:
        "Redirect browser-based device authorization requests to the web UI",
      security: [],
      parameters: [
        {
          name: "user_code",
          in: "query",
          required: false,
          schema: {
            type: "string",
          },
          description: "The device authorization user code.",
        },
        {
          name: "ui",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["1"],
          },
          description: "Force a redirect to the web UI.",
        },
      ],
      responses: {
        302: {
          description: "Redirects the browser to the web app device screen",
        },
        200: {
          description: "Device authorization payload from Better Auth",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("query", authDeviceQuerySchema),
    async (c) => {
      const { user_code: userCode, ui } = c.req.valid("query");
      const secFetchDest = c.req.header("Sec-Fetch-Dest");
      const forceUiRedirect = ui === "1";
      // Top-level browser tab / address bar (not `fetch()` / XHR from the SPA).
      // Optional `ui=1` forces redirect when Sec-Fetch-* headers are missing (e.g. some clients).
      if (forceUiRedirect || secFetchDest === "document") {
        const clientUrl = (
          process.env.KANEO_CLIENT_URL || "http://localhost:5173"
        ).replace(/\/$/, "");
        const deviceUrl = new URL(`${clientUrl}/device`);
        if (userCode) {
          deviceUrl.searchParams.set("user_code", userCode);
        }
        return c.redirect(deviceUrl.toString(), 302);
      }
      return auth.handler(c.req.raw);
    },
  );

  api.on(["POST", "GET", "PUT", "DELETE"], "/auth/*", async (c) => {
    const authHeader = c.req.header("Authorization");
    const apiKeyHeader = c.req.header("x-api-key");
    const bearerMatch = authHeader?.match(/^Bearer\s+(\S+)$/i);

    if (bearerMatch && !apiKeyHeader) {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      // Preserve Better Auth bearer session tokens on auth routes.
      if (session?.session && session.user) {
        return auth.handler(c.req.raw);
      }

      const headers = new Headers(c.req.raw.headers);

      // Better Auth API key plugin validates from x-api-key by default.
      headers.set("x-api-key", bearerMatch[1]);

      return auth.handler(
        new Request(c.req.raw, {
          headers,
        }),
      );
    }

    return auth.handler(c.req.raw);
  });

  api.route("/", mcpRoutes);

  api.use("*", async (c, next) => {
    const path = c.req.path;
    if (path.startsWith("/api/mcp") || path.startsWith("/api/.well-known/")) {
      return next();
    }
    try {
      await authenticateApiRequest(c);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error("API authentication failed:", error);
      throw new HTTPException(500, { message: "Internal Server Error" });
    }
    return next();
  });

  const projectApi = api.route("/project", project);
  const taskApi = api.route("/task", task);
  const columnApi = api.route("/column", column);
  const activityApi = api.route("/activity", activity);
  const commentApi = api.route("/comment", comment);
  const timeEntryApi = api.route("/time-entry", timeEntry);
  const labelApi = api.route("/label", label);
  const notificationApi = api.route("/notification", notification);
  const notificationPreferencesApi = api.route(
    "/notification-preferences",
    notificationPreferences,
  );
  const searchApi = api.route("/search", search);
  const githubIntegrationApi = api.route(
    "/github-integration",
    githubIntegration,
  );
  const giteaIntegrationApi = api.route("/gitea-integration", giteaIntegration);
  const genericWebhookIntegrationApi = api.route(
    "/generic-webhook-integration",
    genericWebhookIntegration,
  );
  const discordIntegrationApi = api.route(
    "/discord-integration",
    discordIntegration,
  );
  const slackIntegrationApi = api.route("/slack-integration", slackIntegration);
  const telegramIntegrationApi = api.route(
    "/telegram-integration",
    telegramIntegration,
  );
  const taskRelationApi = api.route("/task-relation", taskRelation);
  const externalLinkApi = api.route("/external-link", externalLink);
  const workflowRuleApi = api.route("/workflow-rule", workflowRule);
  const invitationApi = api.route("/invitation", invitation);
  const workspaceApi = api.route("/workspace", workspace);

  app.route(
    "/",
    mcpWellKnownRoutes(
      (process.env.KANEO_API_URL || "http://localhost:1337").replace(
        /\/api\/?$/,
        "",
      ),
    ),
  );

  app.route("/api", api);

  return {
    app,
    api,
    activityApi,
    columnApi,
    commentApi,
    configApi,
    discordIntegrationApi,
    externalLinkApi,
    genericWebhookIntegrationApi,
    githubIntegrationApi,
    giteaIntegrationApi,
    invitationApi,
    invitationPublicApi,
    labelApi,
    notificationApi,
    notificationPreferencesApi,
    projectApi,
    publicProjectApi,
    searchApi,
    slackIntegrationApi,
    taskApi,
    taskRelationApi,
    telegramIntegrationApi,
    timeEntryApi,
    workflowRuleApi,
    workspaceApi,
  };
}

export async function runStartupTasks() {
  const currentDir = dirname(fileURLToPath(import.meta.url));

  await migrateWorkspaceUserEmail();
  await migrateSessionColumn();
  await migrateApiKeyReferenceId();

  console.log("🔄 Migrating database...");
  await migrate(db, {
    migrationsFolder: `${currentDir}/../drizzle`,
  });
  console.log("✅ Database migrated successfully!");

  await migrateNotificationPreferencesSchema();
  await migrateGitHubIntegration();
  await migrateColumns();

  initializePlugins();
  initializeScheduler();
}

export async function startServer(port = 1337) {
  try {
    await runStartupTasks();
  } catch (error) {
    console.error("❌ Database migration failed!", error);
    process.exit(1);
  }

  process.on("SIGTERM", () => {
    shutdownScheduler();
  });

  serve(
    {
      fetch: app.fetch,
      port,
    },
    () => {
      console.log(
        `⚡ API is running at ${process.env.KANEO_API_URL || "http://localhost:1337"}`,
      );
    },
  );
}

const createdApp = createApp();
const {
  app,
  activityApi,
  columnApi,
  commentApi,
  configApi,
  discordIntegrationApi,
  externalLinkApi,
  genericWebhookIntegrationApi,
  githubIntegrationApi,
  giteaIntegrationApi,
  invitationApi,
  invitationPublicApi,
  labelApi,
  notificationApi,
  notificationPreferencesApi,
  projectApi,
  publicProjectApi,
  searchApi,
  slackIntegrationApi,
  taskApi,
  taskRelationApi,
  telegramIntegrationApi,
  timeEntryApi,
  workflowRuleApi,
  workspaceApi,
} = createdApp;

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void startServer();
}

export type AppType =
  | typeof configApi
  | typeof projectApi
  | typeof taskApi
  | typeof columnApi
  | typeof activityApi
  | typeof commentApi
  | typeof timeEntryApi
  | typeof labelApi
  | typeof notificationApi
  | typeof notificationPreferencesApi
  | typeof searchApi
  | typeof githubIntegrationApi
  | typeof giteaIntegrationApi
  | typeof genericWebhookIntegrationApi
  | typeof discordIntegrationApi
  | typeof slackIntegrationApi
  | typeof telegramIntegrationApi
  | typeof taskRelationApi
  | typeof externalLinkApi
  | typeof workflowRuleApi
  | typeof invitationApi
  | typeof workspaceApi
  | typeof publicProjectApi
  | typeof invitationPublicApi;

export default app;
