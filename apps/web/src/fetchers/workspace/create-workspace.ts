import { authClient } from "@/lib/auth-client";

export type CreateWorkspaceRequest = {
  name: string;
  description?: string;
  slug?: string;
  logo?: string;
};

const createWorkspace = async ({
  name,
  description,
  slug,
  logo,
}: CreateWorkspaceRequest) => {
  const metadata = description ? { description } : undefined;

  const { data, error } = await authClient.organization.create({
    name,
    slug: slug || name.toLowerCase().replace(/\s+/g, "-"), // TODO
    logo,
    metadata,
  });

  if (error) {
    throw new Error(error.message || "Failed to create workspace");
  }

  return data;
};

export default createWorkspace;
