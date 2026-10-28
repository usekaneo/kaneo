import { useTranslation } from "react-i18next";
import type { RepositoryPath } from "@/components/project/code-hosting/parse-repository-path";
import {
  useCreateGithubIntegration,
  useVerifyGithubInstallation,
} from "@/hooks/mutations/github-integration/use-create-github-integration";
import { toast } from "@/lib/toast";

export function useConnectGithubRepository(projectId: string) {
  const { t } = useTranslation();
  const { mutateAsync: verify, isPending: isVerifying } =
    useVerifyGithubInstallation();
  const { mutateAsync: create, isPending: isCreating } =
    useCreateGithubIntegration();

  const connect = async (repository: RepositoryPath) => {
    const data = {
      repositoryOwner: repository.owner,
      repositoryName: repository.name,
    };
    try {
      const verification = await verify({ ...data, projectId });
      if (!verification.isInstalled) {
        toast.error(t("settings:githubIntegration.toast.installAppFirst"));
        return false;
      }
      if (!verification.hasRequiredPermissions) {
        toast.error(
          t("settings:githubIntegration.toast.missingPermsDetail", {
            list: verification.missingPermissions?.join(", ") || "issues",
          }),
        );
        return false;
      }
      await create({ projectId, data });
      toast.success(t("settings:githubIntegration.toast.updated"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.updateError"),
      );
      return false;
    }
  };

  return { connect, connecting: isVerifying || isCreating };
}
