import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { subscribeToEvent } from "../events";
import createGiteaIntegration from "./controllers/create-gitea-integration";
import deleteGiteaIntegration from "./controllers/delete-gitea-integration";
import getGiteaIntegration from "./controllers/get-gitea-integration";
import { importIssues } from "./controllers/import-issues";
import listGiteaRepositories from "./controllers/list-gitea-repositories";
import verifyGiteaRepository from "./controllers/verify-gitea-repository";
import { handleTaskCreated } from "./utils/task-created-gitea";
import { handleTaskPriorityChanged } from "./utils/task-priority-changed";
import { handleTaskStatusChanged } from "./utils/task-status-changed";
import { handleTaskUpdated } from "./utils/task-updated";

// Subscribe to task events for bi-directional sync (GitHub-style: enhanced with labels)
subscribeToEvent<{
  taskId: string;
  userEmail: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  number: number;
  projectId: string;
}>("task.created", handleTaskCreated);

subscribeToEvent<{
  taskId: string;
  userEmail: string | null;
  oldStatus: string;
  newStatus: string;
  title: string;
}>("task.status_changed", handleTaskStatusChanged);

subscribeToEvent<{
  taskId: string;
  userEmail: string | null;
  oldPriority: string;
  newPriority: string;
  title: string;
}>("task.priority_changed", handleTaskPriorityChanged);

subscribeToEvent<{
  taskId: string;
  userEmail: string | null;
  oldTitle?: string;
  newTitle?: string;
  oldDescription?: string;
  newDescription?: string;
  title: string;
}>("task.updated", handleTaskUpdated);

// Note: Enhanced to match GitHub integration with labels and priority sync

const giteaIntegration = new Hono()
  .get("/repositories", async (c) => {
    const giteaUrl = c.req.query("gitea_url");
    const accessToken = c.req.query("access_token");

    if (!giteaUrl) {
      return c.json({ error: "Gitea URL is required" }, 400);
    }

    const repositories = await listGiteaRepositories(giteaUrl, accessToken);
    return c.json({ repositories });
  })
  .post(
    "/verify",
    zValidator(
      "json",
      z.object({
        giteaUrl: z.string().min(1),
        repositoryOwner: z.string().min(1),
        repositoryName: z.string().min(1),
        accessToken: z
          .string()
          .min(1, "Access token is required for repository verification"),
      }),
    ),
    async (c) => {
      const { giteaUrl, repositoryOwner, repositoryName, accessToken } =
        c.req.valid("json");

      const verification = await verifyGiteaRepository({
        giteaUrl,
        repositoryOwner,
        repositoryName,
        accessToken,
      });

      return c.json(verification);
    },
  )
  .get(
    "/project/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getGiteaIntegration(projectId);
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    zValidator(
      "json",
      z.object({
        giteaUrl: z.string().min(1),
        repositoryOwner: z.string().min(1),
        repositoryName: z.string().min(1),
        accessToken: z
          .string()
          .min(1, "Access token is required for Gitea API access"),
        webhookSecret: z
          .string()
          .min(32, "Webhook secret must be at least 32 characters long")
          .optional(),
      }),
    ),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const {
        giteaUrl,
        repositoryOwner,
        repositoryName,
        accessToken,
        webhookSecret,
      } = c.req.valid("json");

      const integration = await createGiteaIntegration({
        projectId,
        giteaUrl,
        repositoryOwner,
        repositoryName,
        accessToken,
        webhookSecret,
      });

      return c.json(integration);
    },
  )
  .delete(
    "/project/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const result = await deleteGiteaIntegration(projectId);
      return c.json(result);
    },
  )
  .post(
    "/import-issues",
    zValidator("json", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("json");
      const result = await importIssues(projectId);
      return c.json(result);
    },
  )
  .post("/webhook", async (c) => {
    try {
      const eventType = c.req.header("x-gitea-event");

      if (!eventType) {
        return c.json({ error: "Missing event type" }, 400);
      }

      // Get webhook signature for verification
      const signature = c.req.header("x-gitea-signature");

      // Get raw body for signature verification
      const rawBody = await c.req.text();

      // Parse the webhook payload
      const payload = JSON.parse(rawBody);

      // Import webhook processor
      const { processGiteaWebhook } = await import(
        "./webhook-handlers/webhook-processor"
      );

      // Process the webhook with raw body for signature verification
      const result = await processGiteaWebhook(
        eventType,
        payload,
        signature,
        rawBody,
      );

      return c.json(result);
    } catch (error) {
      console.error("Webhook processing error:", error);
      return c.json(
        {
          error: "Webhook processing failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        400,
      );
    }
  });
export default giteaIntegration;
