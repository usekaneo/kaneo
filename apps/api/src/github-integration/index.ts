import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable, projectTable } from "../database/schema";
import { handleGitHubWebhook } from "../plugins/github/webhook-handler";
import { githubIntegrationSchema } from "../schemas";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGithubIntegration from "./controllers/create-github-integration";
import deleteGithubIntegration from "./controllers/delete-github-integration";
import getGithubIntegration from "./controllers/get-github-integration";
import { importIssues } from "./controllers/import-issues";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";

const githubAppInfoSchema = v.object({
  appName: v.nullable(v.string()),
});

const githubRepositorySchema = v.object({
  id: v.number(),
  name: v.string(),
  full_name: v.string(),
  owner: v.object({
    login: v.string(),
  }),
  private: v.boolean(),
  html_url: v.string(),
});

const verificationResultSchema = v.object({
  installed: v.boolean(),
  message: v.optional(v.string()),
});

const importResultSchema = v.object({
  imported: v.number(),
  skipped: v.number(),
  errors: v.optional(v.array(v.string())),
});

const githubIntegration = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
    apiKey?: {
      id: string;
      userId: string;
      enabled: boolean;
    };
  };
}>()
  .get(
    "/app-info",
    describeRoute({
      operationId: "getGitHubAppInfo",
      tags: ["GitHub"],
      description: "Get GitHub app configuration information",
      responses: {
        200: {
          description: "GitHub app information",
          content: {
            "application/json": { schema: resolver(githubAppInfoSchema) },
          },
        },
      },
    }),
    async (c) => {
      return c.json({
        appName: process.env.GITHUB_APP_NAME || null,
      });
    },
  )
  .get(
    "/repositories",
    describeRoute({
      operationId: "listGitHubRepositories",
      tags: ["GitHub"],
      description: "List all accessible GitHub repositories",
      responses: {
        200: {
          description: "List of repositories",
          content: {
            "application/json": {
              schema: resolver(v.array(githubRepositorySchema)),
            },
          },
        },
      },
    }),
    async (c) => {
      const repositories = await listUserRepositories();
      return c.json(repositories);
    },
  )
  .post(
    "/verify",
    describeRoute({
      operationId: "verifyGitHubInstallation",
      tags: ["GitHub"],
      description: "Verify GitHub app installation for a repository",
      responses: {
        200: {
          description: "Verification result",
          content: {
            "application/json": { schema: resolver(verificationResultSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        repositoryOwner: v.pipe(v.string(), v.minLength(1)),
        repositoryName: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    async (c) => {
      const { repositoryOwner, repositoryName } = c.req.valid("json");

      const verification = await verifyGithubInstallation({
        repositoryOwner,
        repositoryName,
      });

      return c.json(verification);
    },
  )
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getGitHubIntegration",
      tags: ["GitHub"],
      description: "Get GitHub integration for a project",
      responses: {
        200: {
          description: "GitHub integration details",
          content: {
            "application/json": { schema: resolver(githubIntegrationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getGithubIntegration(projectId);
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createGitHubIntegration",
      tags: ["GitHub"],
      description: "Create a new GitHub integration for a project",
      responses: {
        200: {
          description: "Integration created successfully",
          content: {
            "application/json": { schema: resolver(githubIntegrationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        repositoryOwner: v.pipe(v.string(), v.minLength(1)),
        repositoryName: v.pipe(v.string(), v.minLength(1)),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { repositoryOwner, repositoryName } = c.req.valid("json");

      const integration = await createGithubIntegration({
        projectId,
        repositoryOwner,
        repositoryName,
      });

      return c.json(integration);
    },
  )
  .patch(
    "/project/:projectId",
    describeRoute({
      operationId: "updateGitHubIntegration",
      tags: ["GitHub"],
      description: "Update GitHub integration settings",
      responses: {
        200: {
          description: "Integration updated successfully",
          content: {
            "application/json": { schema: resolver(githubIntegrationSchema) },
          },
        },
        404: {
          description: "Integration not found",
          content: {
            "application/json": {
              schema: resolver(v.object({ error: v.string() })),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        isActive: v.optional(v.boolean()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { isActive } = c.req.valid("json");

      const existingIntegration = await getGithubIntegration(projectId);

      if (!existingIntegration) {
        return c.json({ error: "Integration not found" }, 404);
      }

      const [updatedIntegration] = await db
        .update(integrationTable)
        .set({
          isActive:
            isActive !== undefined ? isActive : existingIntegration.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(integrationTable.projectId, projectId),
            eq(integrationTable.type, "github"),
          ),
        )
        .returning();

      return c.json(updatedIntegration, 200);
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "deleteGitHubIntegration",
      tags: ["GitHub"],
      description: "Delete GitHub integration for a project",
      responses: {
        200: {
          description: "Integration deleted successfully",
          content: {
            "application/json": { schema: resolver(githubIntegrationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const result = await deleteGithubIntegration(projectId);
      return c.json(result);
    },
  )
  .post(
    "/import-issues",
    describeRoute({
      operationId: "importGitHubIssues",
      tags: ["GitHub"],
      description: "Import GitHub issues as tasks",
      responses: {
        200: {
          description: "Issues imported successfully",
          content: {
            "application/json": { schema: resolver(importResultSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        projectId: v.string(),
      }),
    ),
    async (c, next) => {
      const userId = c.get("userId");
      if (!userId) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }

      const body = await c.req.json();
      const projectId = body.projectId as string;

      const [project] = await db
        .select({ workspaceId: projectTable.workspaceId })
        .from(projectTable)
        .where(eq(projectTable.id, projectId))
        .limit(1);

      if (!project) {
        throw new HTTPException(404, { message: "Project not found" });
      }

      const apiKey = c.get("apiKey");
      const apiKeyId = apiKey?.id;

      await validateWorkspaceAccess(userId, project.workspaceId, apiKeyId);
      c.set("workspaceId", project.workspaceId);

      return next();
    },
    async (c) => {
      const { projectId } = c.req.valid("json");
      const result = await importIssues(projectId);
      return c.json(result);
    },
  );

export async function handleGithubWebhookRoute(c: Context) {
  const arrayBuffer = await c.req.arrayBuffer();
  const body = Buffer.from(arrayBuffer).toString("utf8");

  const signature = c.req.header("x-hub-signature-256");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const eventName = c.req.header("x-github-event");
  if (!eventName) {
    return c.json({ error: "Missing event name" }, 400);
  }

  const deliveryId = c.req.header("x-github-delivery") || "";

  const result = await handleGitHubWebhook(
    body,
    signature,
    eventName,
    deliveryId,
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ status: "success" });
}
export default githubIntegration;
