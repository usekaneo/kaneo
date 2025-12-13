import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { githubIntegrationTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import { githubIntegrationSchema } from "../schemas";
import createGithubIntegration from "./controllers/create-github-integration";
import deleteGithubIntegration from "./controllers/delete-github-integration";
import getGithubIntegration from "./controllers/get-github-integration";
import { importIssues } from "./controllers/import-issues";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";
import createGithubApp from "./utils/create-github-app";
import { handleIssueClosed } from "./utils/issue-closed";
import { handleIssueOpened } from "./utils/issue-opened";
import { handleTaskCreated } from "./utils/task-created";
import { handleTaskPriorityChanged } from "./utils/task-priority-changed";
import { handleTaskStatusChanged } from "./utils/task-status-changed";

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

const githubApp = createGithubApp();

if (githubApp) {
  githubApp.webhooks.on("issues.opened", handleIssueOpened);
  githubApp.webhooks.on("issues.closed", handleIssueClosed);
}

subscribeToEvent<{
  taskId: string;
  userId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  number: number;
  projectId: string;
}>("task.created", handleTaskCreated);

subscribeToEvent<{
  taskId: string;
  userId: string | null;
  oldStatus: string;
  newStatus: string;
  title: string;
}>("task.status_changed", handleTaskStatusChanged);

subscribeToEvent<{
  taskId: string;
  userId: string | null;
  oldPriority: string;
  newPriority: string;
  title: string;
}>("task.priority_changed", handleTaskPriorityChanged);

const githubIntegration = new Hono()
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
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { isActive } = c.req.valid("json");

      const existingIntegration = await getGithubIntegration(projectId);

      if (!existingIntegration) {
        return c.json({ error: "Integration not found" }, 404);
      }

      const [updatedIntegration] = await db
        .update(githubIntegrationTable)
        .set({
          isActive:
            isActive !== undefined ? isActive : existingIntegration.isActive,
          updatedAt: new Date(),
        })
        .where(eq(githubIntegrationTable.projectId, projectId))
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
    async (c) => {
      const { projectId } = c.req.valid("json");
      const result = await importIssues(projectId);
      return c.json(result);
    },
  )
  .post("/webhook", async (c) => {
    try {
      if (!githubApp) {
        return c.json({ error: "GitHub integration not configured" }, 400);
      }

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

      await githubApp.webhooks.verifyAndReceive({
        id: deliveryId,
        name: eventName as "issues" | "pull_request" | "push" | string,
        signature,
        payload: body,
      });

      return c.json({ status: "success" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return c.json({ error: "Webhook processing failed" }, 400);
    }
  });

export default githubIntegration;
