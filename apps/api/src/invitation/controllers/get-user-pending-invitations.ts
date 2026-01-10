import { getUserPendingInvitations as getUserPendingInvitationsUtil } from "../../utils/check-registration-allowed";

export default async function getUserPendingInvitations(userEmail: string) {
  return await getUserPendingInvitationsUtil(userEmail);
}
