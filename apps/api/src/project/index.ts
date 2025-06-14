import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import createProject from "./controllers/create-project";
import deleteProject from "./controllers/delete-project";
import getProject from "./controllers/get-project";
import getProjects from "./controllers/get-projects";
import updateProject from "./controllers/update-project";

const project = new Hono()
  .get(
    "/",
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("query");
      const projects = await getProjects(workspaceId);
      return c.json(projects);
    },
  )
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        workspaceId: z.string(),
        icon: z.string(),
        slug: z.string(),
      }),
    ),
    async (c) => {
      const { name, workspaceId, icon, slug } = c.req.valid("json");
      const project = await createProject(workspaceId, name, icon, slug);
      return c.json(project);
    },
  )
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const project = await deleteProject(id);

      return c.json(project);
    },
  )
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator(
      "json",
      z.object({
        name: z.string(),
        icon: z.string(),
        slug: z.string(),
        description: z.string(),
        isPublic: z.boolean(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, icon, slug, description, isPublic } = c.req.valid("json");

      const project = await updateProject(
        id,
        name,
        icon,
        slug,
        description,
        isPublic,
      );

      return c.json(project);
    },
  )
  .get(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { workspaceId } = c.req.valid("query");

      const project = await getProject(id, workspaceId);

      return c.json(project);
    },
  );

export default project;
