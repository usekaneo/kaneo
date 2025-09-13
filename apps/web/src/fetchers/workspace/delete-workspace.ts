import { authClient } from "@/lib/auth-client";

type DeleteWorkspaceRequest = {
  id: string;
};

const deleteWorkspace = async ({ id }: DeleteWorkspaceRequest) => {
  const { data, error } = await authClient.organization.delete({
    organizationId: id,
  });

  if (error) {
    throw new Error(error.message || "Failed to delete workspace");
  }

  return data;
};

export default deleteWorkspace;
