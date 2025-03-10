import Elysia, { t } from "elysia";
import createWorkspace from "./controllers/create-workspace";
import deleteWorkspace from "./controllers/delete-workspace";
import getWorkspace from "./controllers/get-workspace";
import getWorkspaces from "./controllers/get-workspaces";
import updateWorkspace from "./controllers/update-workspace";

const workspace = new Elysia({ prefix: "/workspace" })
  .state("userEmail", "")
  .post(
    "/create",
    async ({ body: { name }, store }) => {
      const userEmail = store.userEmail;

      const createdWorkspace = await createWorkspace(name, userEmail);

      return createdWorkspace;
    },
    {
      body: t.Object({
        name: t.String(),
      }),
    },
  )
  .get("/list", async ({ store }) => {
    const userEmail = store.userEmail;

    const workspaces = await getWorkspaces(userEmail);

    return workspaces;
  })
  .get("/:id", async ({ store, params }) => {
    const userEmail = store.userEmail;
    const workspaceId = params.id;

    const workspace = await getWorkspace(userEmail, workspaceId);

    return workspace;
  })
  .put(
    "/:id",
    async ({ store, params, body: { name, description } }) => {
      const userEmail = store.userEmail;
      const workspaceId = params.id;

      const updatedWorkspace = await updateWorkspace(
        userEmail,
        workspaceId,
        name,
        description,
      );

      return updatedWorkspace;
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.String(),
      }),
    },
  )
  .delete("/:id", async ({ store, params }) => {
    const userEmail = store.userEmail;
    const workspaceId = params.id;

    const deletedWorkspace = await deleteWorkspace(userEmail, workspaceId);

    return deletedWorkspace;
  });

export default workspace;
