import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { createSlug } from "@/lib/utils/create-slug";

type CreateWorkspaceRequest = {
  name: string;
  description?: string;
  logo?: string;
  slug?: string;
  keepCurrentActiveOrganization?: boolean;
  userId?: string;
};

function useCreateWorkspace() {
  return useMutation({
    mutationFn: async ({
      name,
      description,
      logo,
      slug,
      keepCurrentActiveOrganization = false,
      userId,
    }: CreateWorkspaceRequest) => {
      const metadata = description ? { description } : undefined;
      const workspaceSlug = slug || createSlug(name);

      const { data, error } = await authClient.organization.create({
        name,
        slug: workspaceSlug,
        logo: logo || undefined,
        metadata,
        keepCurrentActiveOrganization,
        userId: userId,
      });

      if (error) {
        throw new Error(error.message || "Failed to create workspace");
      }

      return data;
    },
  });
}

export default useCreateWorkspace;
