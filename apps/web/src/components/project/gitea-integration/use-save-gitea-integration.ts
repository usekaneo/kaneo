import { useTranslation } from "react-i18next";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import type { GiteaAccess } from "@/components/project/gitea-integration/gitea-access";
import {
  useCreateGiteaIntegration,
  useVerifyGiteaAccess,
} from "@/hooks/mutations/gitea-integration/use-create-gitea-integration";
import { toast } from "@/lib/toast";

export function useSaveGiteaIntegration(projectId: string) {
  const { t } = useTranslation();
  const { mutateAsync: verify, isPending: isVerifying } =
    useVerifyGiteaAccess();
  const { mutateAsync: create, isPending: isCreating } =
    useCreateGiteaIntegration();

  const save = async (access: GiteaAccess, alreadyVerified: boolean) => {
    try {
      if (access.accessToken && !alreadyVerified) {
        const verification = await verify({ projectId, ...access });
        if (!isAccessVerified(verification)) {
          toast.error(t("settings:giteaIntegration.toast.verifyFirst"));
          return false;
        }
      }
      await create({
        projectId,
        data: {
          baseUrl: access.baseUrl,
          ...(access.accessToken ? { accessToken: access.accessToken } : {}),
          repositoryOwner: access.repositoryOwner,
          repositoryName: access.repositoryName,
        },
      });
      toast.success(t("settings:giteaIntegration.toast.updated"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.updateError"),
      );
      return false;
    }
  };

  return { save, saving: isVerifying || isCreating };
}
