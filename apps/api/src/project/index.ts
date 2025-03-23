import Elysia, { t } from "elysia";
import createProject from "./controllers/create-project";
import deleteProject from "./controllers/delete-project";
import getProject from "./controllers/get-project";
import getProjects from "./controllers/get-projects";
import updateProject from "./controllers/update-project";

const project = new Elysia({ prefix: "/project" })
  .post(
    "/create",
    async ({ body: { workspaceId, icon, slug, name } }) => {
      const createdProject = await createProject(workspaceId, name, icon, slug);

      return createdProject;
    },
    {
      body: t.Object({
        name: t.String(),
        workspaceId: t.String(),
        icon: t.String(),
        slug: t.String(),
      }),
    },
  )
  .get("/list/:workspaceId", async ({ params: { workspaceId } }) => {
    const projects = await getProjects(workspaceId);

    return projects;
  })
  .get("/:id", async ({ params: { id }, query: { workspaceId } }) => {
    if (!workspaceId) throw new Error("Workspace ID is required");

    const project = await getProject(id, workspaceId);

    return project;
  })
  .put(
    "/:id",
    async ({
      params: { id },
      body: { workspaceId, name, description, icon, slug },
    }) => {
      const updatedProject = await updateProject(
        id,
        workspaceId,
        name,
        description,
        icon,
        slug,
      );

      return updatedProject;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.String(),
        icon: t.String(),
        slug: t.String(),
      }),
    },
  )
  .delete("/:id", async ({ params: { id } }) => {
    const deletedProject = await deleteProject(id);

    return deletedProject;
  });

export default project;
