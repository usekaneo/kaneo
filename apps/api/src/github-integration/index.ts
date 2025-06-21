import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { subscribeToEvent } from "../events";
import createGithubIntegration from "./controllers/create-github-integration";
import deleteGithubIntegration from "./controllers/delete-github-integration";
import getGithubIntegration from "./controllers/get-github-integration";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";
import githubApp from "./utils/create-github-app";
import { handleIssueOpened } from "./utils/issue-opened";
import { handleTaskCreated } from "./utils/task-created";

githubApp.webhooks.on("issues.opened", handleIssueOpened);

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

const githubIntegration = new Hono()
  .get("/app-info", async (c) => {
    return c.json({
      appName: process.env.GITHUB_APP_NAME || null,
    });
  })
  .get("/repositories", async (c) => {
    const repositories = await listUserRepositories();
    return c.json(repositories);
  })
  .post(
    "/verify",
    zValidator(
      "json",
      z.object({
        repositoryOwner: z.string().min(1),
        repositoryName: z.string().min(1),
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
    zValidator("param", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getGithubIntegration(projectId);
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    zValidator(
      "json",
      z.object({
        repositoryOwner: z.string().min(1),
        repositoryName: z.string().min(1),
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
  .delete(
    "/project/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const result = await deleteGithubIntegration(projectId);
      return c.json(result);
    },
  )
  .post("/webhook", async (c) => {
    try {
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
