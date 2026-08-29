import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { WorkspaceUserInvitation } from "@/types/workspace-user";

export async function getPendingInvitations(): Promise<
  WorkspaceUserInvitation[]
> {
  const response = await client.invitation.pending.$get();

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to get pending invitations");
  }

  return response.json();
}
