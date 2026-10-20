import { UsersRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { DirectorySkeletonRows } from "@/components/admin/directory/directory-skeleton-rows";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";

type WorkspaceMembersCardProps = {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  children: ReactNode;
};

export function WorkspaceMembersCard({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  children,
}: WorkspaceMembersCardProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      {isLoading ? (
        <DirectorySkeletonRows rows={3} withAvatar />
      ) : isError ? (
        <DirectoryErrorRow
          message={t("settings:adminWorkspaces.members.loadError")}
          retryLabel={t("settings:adminWorkspaces.retry")}
          onRetry={onRetry}
        />
      ) : isEmpty ? (
        <SettingsEmpty
          icon={<UsersRoundIcon />}
          title={t("settings:adminWorkspaces.members.empty")}
        />
      ) : (
        <div
          role="list"
          aria-label={t("settings:adminWorkspaces.columns.members")}
          className="divide-y divide-border"
        >
          {children}
        </div>
      )}
    </SettingsCard>
  );
}
