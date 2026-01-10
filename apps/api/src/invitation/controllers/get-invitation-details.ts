import { getInvitationDetails } from "../../utils/check-registration-allowed";

export default async function getInvitationDetailsController(
  invitationId: string,
) {
  return await getInvitationDetails(invitationId);
}
