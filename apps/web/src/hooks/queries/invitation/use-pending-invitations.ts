import { useQuery } from "@tanstack/react-query";
import { getPendingInvitations } from "@/fetchers/invitation/get-pending-invitations";
import { authClient } from "@/lib/auth-client";

export function usePendingInvitations() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["invitations", "pending", session?.user?.email],
    queryFn: getPendingInvitations,
    enabled: !!session?.user?.email,
    refetchInterval: 60000,
  });
}
