import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { createSlug } from "@/lib/utils/create-slug";

type UpdateWorkspaceRequest = {
  workspaceId: string;
  name?: string;
  slug?: string;
  logo?: string;
  metadata?: Record<string, unknown>;
};

function useUpdateWorkspace() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      slug,
      logo,
      metadata,
    }: UpdateWorkspaceRequest) => {
      const updateData: {
        name?: string;
        slug?: string;
        logo?: string;
        metadata?: Record<string, unknown>;
      } = {};

      if (name !== undefined) {
        updateData.name = name;
        if (slug === undefined) {
          updateData.slug = createSlug(name);
        }
      }

      if (slug !== undefined) {
        updateData.slug = slug;
      }

      if (logo !== undefined) {
        updateData.logo = logo;
      }

      if (metadata !== undefined) {
        updateData.metadata = metadata;
      }

      const { data, error } = await authClient.organization.update({
        data: updateData,
        organizationId: workspaceId,
      });

      if (error) {
        throw new Error(error.message || "Failed to update workspace");
      }

      return data;
    },
  });
}

export default useUpdateWorkspace;
