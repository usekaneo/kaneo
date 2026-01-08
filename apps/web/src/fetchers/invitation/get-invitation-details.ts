import { client } from "@kaneo/libs";

export type InvitationDetails = {
  id: string;
  email: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: string;
  status: string;
  expired: boolean;
};

export type GetInvitationDetailsResponse = {
  valid: boolean;
  invitation?: InvitationDetails;
  error?: string;
};

export async function getInvitationDetails(
  invitationId: string,
): Promise<GetInvitationDetailsResponse> {
  const response = await client.invitation[":id"].$get({
    param: {
      id: invitationId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}
