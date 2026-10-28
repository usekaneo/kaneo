import { MessageSquareIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccessStatusLine } from "@/components/project/code-hosting/access-status-line";
import type { AccessVerificationResult } from "@/components/project/code-hosting/access-verification-tone";
import { CommentLinkRow } from "@/components/project/code-hosting/comment-link-row";
import { RepositoryLink } from "@/components/project/code-hosting/repository-link";
import { StoredTokenRow } from "@/components/project/code-hosting/stored-token-row";
import { GiteaChangeToken } from "@/components/project/gitea-integration/gitea-change-token";
import { IntegrationCheckLine } from "@/components/project/integrations/panel/integration-check-line";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Button } from "@/components/ui/button";
import type { GiteaIntegration } from "@/fetchers/gitea-integration/get-gitea-integration";
import { useUpdateGiteaIntegration } from "@/hooks/mutations/gitea-integration/use-update-gitea-integration";
import { toast } from "@/lib/toast";

type GiteaRepositorySectionProps = {
  projectId: string;
  integration: GiteaIntegration;
  status: {
    checking: boolean;
    result: AccessVerificationResult | undefined;
    error: unknown;
  };
  editingToken: boolean;
  reconnecting: boolean;
  onEditingTokenChange: (editing: boolean) => void;
  onReconnect: () => void;
};

export function GiteaRepositorySection({
  projectId,
  integration,
  status,
  editingToken,
  reconnecting,
  onEditingTokenChange,
  onReconnect,
}: GiteaRepositorySectionProps) {
  const { t } = useTranslation();
  const { mutateAsync: update, isPending } = useUpdateGiteaIntegration();
  const isConnected = Boolean(integration.isActive);
  const name = `${integration.repositoryOwner}/${integration.repositoryName}`;
  const href = `${integration.baseUrl.replace(/\/$/, "")}/${name}`;

  const toggleComment = async (next: boolean) => {
    try {
      await update({
        projectId,
        json: { commentTaskLinkOnGiteaIssue: next },
      });
      toast.success(
        next
          ? t("settings:giteaIntegration.toast.commentOnEnabled")
          : t("settings:giteaIntegration.toast.commentOnDisabled"),
        { icon: MessageSquareIcon },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.settingsUpdateError"),
      );
    }
  };

  return (
    <IntegrationPanelSection
      label={t("settings:codeHosting.repositorySection")}
    >
      <div className="min-w-0 space-y-1">
        <RepositoryLink name={name} href={href} />
        {isConnected ? (
          <AccessStatusLine
            {...status}
            fallbackError={t("settings:giteaIntegration.toast.verifyError")}
          />
        ) : null}
      </div>
      {isConnected ? null : (
        <IntegrationCheckLine
          tone="warning"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={reconnecting}
              onClick={onReconnect}
            >
              {t("settings:codeHosting.reconnect")}
            </Button>
          }
        >
          {t("settings:codeHosting.pausedHint")}
        </IntegrationCheckLine>
      )}
      {isConnected ? (
        <CommentLinkRow
          title={t("settings:giteaIntegration.commentTaskLinkTitle")}
          description={t("settings:giteaIntegration.commentTaskLinkHint")}
          checked={integration.commentTaskLinkOnGiteaIssue ?? true}
          disabled={isPending}
          onCheckedChange={toggleComment}
        />
      ) : null}
      <StoredTokenRow
        maskedToken={integration.maskedAccessToken}
        editing={editingToken}
        onEdit={() => onEditingTokenChange(true)}
      />
      {editingToken ? (
        <GiteaChangeToken
          projectId={projectId}
          integration={integration}
          onDone={() => onEditingTokenChange(false)}
        />
      ) : null}
    </IntegrationPanelSection>
  );
}
