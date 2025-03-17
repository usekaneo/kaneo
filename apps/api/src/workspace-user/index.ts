import Elysia, { t } from "elysia";
import deleteWorkspaceUser from "./controllers/delete-workspace-user";
import getWorkspaceUsers from "./controllers/get-workspace-users";
import inviteWorkspaceUser from "./controllers/invite-workspace-user";
import "./events";
import getActiveWorkspaceUsers from "./controllers/get-active-workspace-users";

const workspaceUser = new Elysia({ prefix: "/workspace-user" })
  .get(
    "/list/:workspaceId",
    async ({ params: { workspaceId } }) => {
      const workspaceUsersInWorkspace = await getWorkspaceUsers({
        workspaceId,
      });

      return workspaceUsersInWorkspace;
    },
    {
      params: t.Object({
        workspaceId: t.String(),
      }),
    },
  )
  .post(
    "/:workspaceId/invite",
    async ({ body }) => {
      const invitedWorkspaceUser = await inviteWorkspaceUser(body);

      return invitedWorkspaceUser;
    },
    {
      body: t.Object({
        userEmail: t.String(),
        workspaceId: t.String(),
      }),
    },
  )
  .delete(
    "/:workspaceId/:userEmail",
    async ({ params: { workspaceId, userEmail } }) => {
      await deleteWorkspaceUser({ workspaceId, userEmail });
    },
    {
      params: t.Object({
        workspaceId: t.String(),
        userEmail: t.String(),
      }),
    },
  )
  .get("/:workspaceId/active", async ({ params: { workspaceId } }) => {
    const activeWorkspaceUsers = await getActiveWorkspaceUsers(workspaceId);

    return activeWorkspaceUsers;
  })
  .onError(({ code, error }) => {
    switch (code) {
      case "VALIDATION":
        return error.all;
      default:
        if (error instanceof Error) {
          return {
            name: error.name,
            message: error.message,
          };
        }
    }
  });

export default workspaceUser;
