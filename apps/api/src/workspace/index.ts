import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import createWorkspace from "./controllers/create-workspace";
import deleteWorkspace from "./controllers/delete-workspace";
import getWorkspace from "./controllers/get-workspace";
import getWorkspaces from "./controllers/get-workspaces";
import updateWorkspace from "./controllers/update-workspace";

const workspace = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get("/", async (c) => {
    const userId = c.get("userId");

    const workspaces = await getWorkspaces(userId);

    return c.json(workspaces);
  })
  .get("/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
    const id = c.req.param("id");

    const userId = c.get("userId");

    const workspace = await getWorkspace(userId, id);

    return c.json(workspace);
  })
  .post(
    "/",
    zValidator("json", z.object({ name: z.string(), description: z.string() })),
    async (c) => {
      const { name } = c.req.valid("json");

      const userId = c.get("userId");

      const workspace = await createWorkspace(name, userId);

      return c.json(workspace);
    },
  )
  .put(
    "/:id",
    zValidator("json", z.object({ name: z.string(), description: z.string() })),
    async (c) => {
      const id = c.req.param("id");
      const { name, description } = c.req.valid("json");

      const userId = c.get("userId");

      const workspace = await updateWorkspace(userId, id, name, description);

      return c.json(workspace);
    },
  )
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const id = c.req.param("id");

      const userId = c.get("userId");

      const workspace = await deleteWorkspace(userId, id);

      return c.json(workspace);
    },
  );

export default workspace;
