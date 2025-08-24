import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

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
