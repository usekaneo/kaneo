import { authClient } from "@/lib/auth-client";

type UpdateWorkspaceRequest = {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  slug?: string;
};

const updateWorkspace = async ({
  id,
  name,
  description,
  logo,
  slug,
}: UpdateWorkspaceRequest) => {
  const metadata = description ? { description } : undefined;

  const { data, error } = await authClient.organization.update({
    organizationId: id,
    data: {
      name,
      slug,
      logo,
      metadata,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to update workspace");
  }

  return data;
};

export default updateWorkspace;
