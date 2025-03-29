import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type InviteWorkspaceMemberRequest = InferRequestType<
  (typeof client)["workspace-user"][":workspaceId"]["invite"]["$post"]
>["json"] &
  InferRequestType<
    (typeof client)["workspace-user"][":workspaceId"]["invite"]["$post"]
  >["param"];

const inviteWorkspaceMember = async ({
  workspaceId,
  userEmail,
}: InviteWorkspaceMemberRequest) => {
  const response = await client["workspace-user"][":workspaceId"].invite.$post({
    json: { userEmail },
    param: { workspaceId },
  });

  const data = await response.json();

  return data;
};

export default inviteWorkspaceMember;
