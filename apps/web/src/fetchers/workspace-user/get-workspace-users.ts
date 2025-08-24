import { authClient } from "@/lib/auth-client";

export type GetWorkspaceUsersRequest = {
  workspaceId: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

async function getWorkspaceUsers({
  workspaceId,
  limit,
  offset,
  sortBy,
  sortDirection,
}: GetWorkspaceUsersRequest) {
  const { data, error } = await authClient.organization.listMembers({
    query: {
      organizationId: workspaceId,
      limit,
      offset,
      sortBy,
      sortDirection,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch workspace users");
  }

  return data || [];
}

export default getWorkspaceUsers;
