import Elysia, { t } from "elysia";
import { requireWorkspacePermission } from "../middleware/check-permissions";
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
    const workspace = await getWorkspace(userEmail, params.id);
    return workspace;
  })
  .use(requireWorkspacePermission("owner"))
  .put(
    "/:id",
    async ({ store, params, body }) => {
      const userEmail = store.userEmail;
      const updatedWorkspace = await updateWorkspace(
        userEmail,
        params.id,
        body.name,
        body.description,
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
  .use(requireWorkspacePermission("owner"))
  .delete("/:id", async ({ store, params }) => {
    const userEmail = store.userEmail;
    const deletedWorkspace = await deleteWorkspace(userEmail, params.id);
    return deletedWorkspace;
  })
  .use(requireWorkspacePermission("owner"));

export default workspace;
