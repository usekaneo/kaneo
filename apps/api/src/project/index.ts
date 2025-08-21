import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { auth } from "../auth";
import createProject from "./controllers/create-project";
import deleteProject from "./controllers/delete-project";
import getProject from "./controllers/get-project";
import getProjects from "./controllers/get-projects";
import updateProject from "./controllers/update-project";

const project = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
    userId: string | null;
  };
}>()
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
        icon: z.string(),
        slug: z.string(),
      }),
    ),
    async (c) => {
      const session = c.get("session");
      const { name, icon, slug } = c.req.valid("json");

      // @ts-expect-error activeWorkspaceId is present on session, https://github.com/better-auth/better-auth/issues/3490
      if (!session?.activeOrganizationId) {
        return c.json(
          {
            error: "No active workspace found. Please select a workspace.",
          },
          400,
        );
      }

      const project = await createProject(
        // @ts-expect-error activeWorkspaceId is present on session, https://github.com/better-auth/better-auth/issues/3490
        session.activeOrganizationId,
        name,
        icon,
        slug,
      );
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
