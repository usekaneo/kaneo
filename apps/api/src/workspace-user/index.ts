import Elysia, { t } from "elysia";
import { requireWorkspacePermission } from "../middleware/check-permissions";
import deleteWorkspaceUser from "./controllers/delete-workspace-user";
import getWorkspaceUsers from "./controllers/get-workspace-users";
import inviteWorkspaceUser from "./controllers/invite-workspace-user";
import "./events";
import getActiveWorkspaceUsers from "./controllers/get-active-workspace-users";

const workspaceUser = new Elysia({ prefix: "/workspace-user" })
  .state("userEmail", "")
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
  .use(requireWorkspacePermission("member"))
  .post(
    "/:workspaceId/invite",
    async ({ params: { workspaceId }, body: { userEmail } }) => {
      const invitedUser = await inviteWorkspaceUser({
        workspaceId,
        userEmail,
      });
      return invitedUser;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userEmail: t.String(),
      }),
    },
  )
  .use(requireWorkspacePermission("owner"))
  .delete(
    "/:workspaceId/:userEmail",
    async ({ params: { workspaceId, userEmail } }) => {
      const deletedUser = await deleteWorkspaceUser({
        workspaceId,
        userEmail,
      });
      return deletedUser;
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
