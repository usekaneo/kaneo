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
import { handleTaskAssigneeChanged } from "./utils/task-assignee-changed";
import { handleTaskCreated } from "./utils/task-created-gitea";
import { handleTaskLabelsChanged } from "./utils/task-labels-changed";
import { handleTaskPriorityChanged } from "./utils/task-priority-changed";
import { handleTaskStatusChanged } from "./utils/task-status-changed";
import { handleTaskUpdated } from "./utils/task-updated";

// Subscribe to task events for bi-directional sync
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

subscribeToEvent<{
  taskId: string;
  userEmail: string | null;
  labels: Array<{ name: string; color: string }>;
  title: string;
}>("task.labels_changed", handleTaskLabelsChanged);

subscribeToEvent<{
  taskId: string;
  newAssignee: string | null;
  title: string;
}>("task.assignee_changed", handleTaskAssigneeChanged);

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
        accessToken: z.string().optional(),
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
        accessToken: z.string().optional(),
        webhookSecret: z.string().optional(),
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
      // Note: For future webhook signature verification
      // const arrayBuffer = await c.req.arrayBuffer();

      const eventType = c.req.header("x-gitea-event");
      if (!eventType) {
        return c.json({ error: "Missing event type" }, 400);
      }

      // TODO: Implement webhook signature verification using the webhook secret
      // const signature = c.req.header("x-gitea-signature");

      // Handle different Gitea webhook events
      switch (eventType) {
        case "issues":
          // TODO: Handle issue events (opened, closed, edited)
          break;
        default:
          console.log(`Unhandled Gitea webhook event: ${eventType}`);
      }

      return c.json({ status: "success" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return c.json({ error: "Webhook processing failed" }, 400);
    }
  });
export default giteaIntegration;
