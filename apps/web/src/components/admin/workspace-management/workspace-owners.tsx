import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/settings/status-badge";
import type { AdminWorkspace } from "@/fetchers/admin/workspace-types";

type WorkspaceOwnersProps = {
  owners: AdminWorkspace["owners"];
};

export function WorkspaceOwners({ owners }: WorkspaceOwnersProps) {
  const { t } = useTranslation();

  if (owners.length === 0) {
    return (
      <StatusBadge tone="warning">
        {t("settings:adminWorkspaces.noOwner")}
      </StatusBadge>
    );
  }

  return (
    <span
      className="block min-w-0 truncate text-[13px]"
      title={owners.map((owner) => owner.email).join(", ")}
    >
      {owners.map((owner) => owner.name || owner.email).join(", ")}
    </span>
  );
}
