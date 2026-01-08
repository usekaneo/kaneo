import { useQuery } from "@tanstack/react-query";
import { getInvitationDetails } from "@/fetchers/invitation/get-invitation-details";

export function useGetInvitationDetails(invitationId: string | undefined) {
  return useQuery({
    queryKey: ["invitation-details", invitationId],
    queryFn: () => getInvitationDetails(invitationId!),
    enabled: !!invitationId,
  });
}
