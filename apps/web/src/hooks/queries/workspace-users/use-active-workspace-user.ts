import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const useGetActiveWorkspaceUser = () => {
  return useQuery({
    queryKey: ["workspace-user", "active"],
    queryFn: async () => {
      const { data, error } = await authClient.organization.getActiveMember();

      if (error) {
        throw new Error(error.message || "Failed to get active workspace user");
      }

      return data;
    },
  });
};
