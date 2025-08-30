import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

type GetWorkspaceUsersRequest = {
  workspaceId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filterField?: string;
  filterOperator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";
  filterValue?: string;
};

function useGetWorkspaceUsers({
  workspaceId,
  limit,
  offset,
  sortBy,
  sortDirection,
  filterField,
  filterOperator,
  filterValue,
}: GetWorkspaceUsersRequest) {
  return useQuery({
    queryKey: [
      "workspace-users",
      workspaceId,
      limit,
      offset,
      sortBy,
      sortDirection,
      filterField,
      filterOperator,
      filterValue,
    ],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: {
          organizationId: workspaceId,
          limit,
          offset,
          sortBy,
          sortDirection,
          filterField,
          filterOperator,
          filterValue,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get workspace users");
      }

      return data;
    },
  });
}

export default useGetWorkspaceUsers;
