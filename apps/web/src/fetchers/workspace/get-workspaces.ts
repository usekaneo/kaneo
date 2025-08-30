import { authClient } from "@/lib/auth-client";

const getWorkspaces = async () => {
  const { data, error } = await authClient.organization.list();

  if (error) {
    throw new Error(error.message || "Failed to fetch workspaces");
  }

  return data || [];
};

export default getWorkspaces;
