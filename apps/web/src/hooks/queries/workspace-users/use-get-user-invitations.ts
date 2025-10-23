import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

function useGetUserInvitations() {
  return useQuery({
    queryKey: ["user-invitations"],
    queryFn: async () => {
      const { data, error } =
        await authClient.organization.listUserInvitations();

      if (error) {
        throw new Error(error.message || "Failed to get user invitations");
      }

      return data;
    },
  });
}

export default useGetUserInvitations;
