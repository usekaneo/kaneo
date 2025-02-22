import { subscribeToEvent } from "../../events";
import updateWorkspaceUser from "../controllers/update-workspace-user";

subscribeToEvent("user.signed_up", async (data: { email: string }) => {
  updateWorkspaceUser({
    email: data.email,
    status: "active",
  });
});
