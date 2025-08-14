import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import createTaskLink from "./controllers/create-task-link";
import getTaskLinks from "./controllers/get-task-links";
import deleteTaskLink from "./controllers/delete-task-link";

const taskLink = new Hono<{
  Variables: {
    userEmail: string;
  };
}>();

const LINK_TYPES = [
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicates",
  "parent",
  "child",
] as const;

// List links for a task
taskLink.get(
  "/:taskId",
  zValidator("param", z.object({ taskId: z.string() })),
  async (c) => {
    const { taskId } = c.req.valid("param");
    const links = await getTaskLinks(taskId);
    return c.json(links);
  },
);

// Create a new link
taskLink.post(
  "/:taskId",
  zValidator("param", z.object({ taskId: z.string() })),
  zValidator(
    "json",
    z.object({
      targetTaskId: z.string(),
      type: z.enum(LINK_TYPES).default("relates_to"),
    }),
  ),
  async (c) => {
    const { taskId } = c.req.valid("param");
    const { targetTaskId, type } = c.req.valid("json");
    const userEmail = c.get("userEmail");
    const link = await createTaskLink({
      taskId,
      targetTaskId,
      type,
      userEmail,
    });
    return c.json(link);
  },
);

// Delete a link by ID
taskLink.delete(
  "/:taskId/:linkId",
  zValidator("param", z.object({ taskId: z.string(), linkId: z.string() })),
  async (c) => {
    const { linkId } = c.req.valid("param");
    await deleteTaskLink(linkId);
    return c.json({ deleted: true });
  },
);

export default taskLink;
