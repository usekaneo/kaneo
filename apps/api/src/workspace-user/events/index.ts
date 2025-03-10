import { subscribeToEvent } from "../../events";
import createRootWorkspaceUser from "../controllers/create-root-workspace-user";
import updateWorkspaceUser from "../controllers/update-workspace-user";

subscribeToEvent("user.signed_up", async (data: { email: string }) => {
  await updateWorkspaceUser({
    email: data.email,
    status: "active",
  });
});

subscribeToEvent(
  "workspace.created",
  async (data: { workspaceId: string; ownerEmail: string }) => {
    await createRootWorkspaceUser({
      workspaceId: data.workspaceId,
      userEmail: data.ownerEmail,
    });
  },
);
