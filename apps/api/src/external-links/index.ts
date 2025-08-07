import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createExternalLink } from "./create-external-link";
import { deleteExternalLink } from "./delete-external-link";
import { getExternalLinks } from "./get-external-links";
import { updateExternalLink } from "./update-external-link";

const externalLinksRoute = new Hono<{ Variables: { userEmail: string } }>()
  .get(
    "/task/:taskId",
    zValidator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const links = await getExternalLinks(taskId);
      return c.json({ success: true, data: links });
    },
  )
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        taskId: z.string(),
        type: z.enum([
          "gitea_integration",
          "github_integration",
          "documentation",
          "reference",
          "design",
          "ticket",
          "custom",
        ]),
        title: z.string().min(1),
        url: z.string().url(),
        externalId: z.string().optional(),
      }),
    ),
    async (c) => {
      const userEmail = c.get("userEmail");
      const body = c.req.valid("json");

      const newLink = await createExternalLink({
        ...body,
        createdBy: userEmail,
      });

      return c.json({ success: true, data: newLink }, 201);
    },
  )
  .put(
    "/:linkId",
    zValidator("param", z.object({ linkId: z.string() })),
    zValidator(
      "json",
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
        externalId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { linkId } = c.req.valid("param");
      const body = c.req.valid("json");

      const updatedLink = await updateExternalLink(linkId, body);

      return c.json({ success: true, data: updatedLink });
    },
  )
  .delete(
    "/:linkId",
    zValidator("param", z.object({ linkId: z.string() })),
    async (c) => {
      const { linkId } = c.req.valid("param");

      const deletedLink = await deleteExternalLink(linkId);

      return c.json({ success: true, data: deletedLink });
    },
  );

export default externalLinksRoute;
