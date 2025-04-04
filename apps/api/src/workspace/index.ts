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
    userEmail: string;
  };
}>()
  .get("/", async (c) => {
    const userEmail = c.get("userEmail");

    const workspaces = await getWorkspaces(userEmail);

    return c.json(workspaces);
  })
  .get("/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
    const id = c.req.param("id");

    const userEmail = c.get("userEmail");

    const workspace = await getWorkspace(userEmail, id);

    return c.json(workspace);
  })
  .post("/", zValidator("json", z.object({ name: z.string() })), async (c) => {
    const { name } = c.req.valid("json");

    const userEmail = c.get("userEmail");

    const workspace = await createWorkspace(name, userEmail);

    return c.json(workspace);
  })
  .put(
    "/:id",
    zValidator("json", z.object({ name: z.string(), description: z.string() })),
    async (c) => {
      const id = c.req.param("id");
      const { name, description } = c.req.valid("json");

      const userEmail = c.get("userEmail");

      const workspace = await updateWorkspace(userEmail, id, name, description);

      return c.json(workspace);
    },
  )
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const id = c.req.param("id");

      const userEmail = c.get("userEmail");

      const workspace = await deleteWorkspace(userEmail, id);

      return c.json(workspace);
    },
  );

export default workspace;
