import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import {
  createUniqueWorkspaceSlug,
  isWorkspaceSlugCollisionError,
} from "@/lib/utils/create-workspace-slug";

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
      const existingWorkspaces = slug
        ? []
        : ((await authClient.organization.list()).data ?? []);
      let workspaceSlug = slug
        ? slug
        : createUniqueWorkspaceSlug(
            name,
            existingWorkspaces.map((workspace) => workspace.slug),
          );

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await authClient.organization.create({
          name,
          slug: workspaceSlug,
          logo: logo || undefined,
          metadata,
          keepCurrentActiveOrganization,
          userId: userId,
        });

        if (!error) {
          return data;
        }

        const createError = new Error(
          error.message || "Failed to create workspace",
        );

        if (slug || !isWorkspaceSlugCollisionError(createError)) {
          throw createError;
        }

        workspaceSlug = createUniqueWorkspaceSlug(name, [
          ...existingWorkspaces.map((workspace) => workspace.slug),
          workspaceSlug,
        ]);
      }

      throw new Error("Failed to create workspace");
    },
  });
}

export default useCreateWorkspace;
