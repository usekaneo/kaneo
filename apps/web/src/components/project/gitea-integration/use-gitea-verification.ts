import { useDebouncedCheck } from "@/components/project/code-hosting/use-debounced-check";
import {
  type GiteaAccess,
  giteaAccessKey,
} from "@/components/project/gitea-integration/gitea-access";
import { useVerifyGiteaAccess } from "@/hooks/mutations/gitea-integration/use-create-gitea-integration";

export function useGiteaVerification(
  projectId: string,
  access: GiteaAccess | null,
) {
  const { mutateAsync: verify } = useVerifyGiteaAccess();

  return useDebouncedCheck(access ? giteaAccessKey(access) : null, () => {
    if (!access) throw new Error("Missing Gitea access");
    return verify({
      projectId,
      baseUrl: access.baseUrl,
      accessToken: access.accessToken,
      repositoryOwner: access.repositoryOwner,
      repositoryName: access.repositoryName,
    });
  });
}
