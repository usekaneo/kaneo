import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { AdminWorkspace } from "@/fetchers/admin/workspace-types";
import { formatDateMedium } from "@/lib/format";

type Props = {
  workspace: AdminWorkspace;
  onManage: () => void;
};

function WorkspaceTableRow({ workspace, onManage }: Props) {
  const { t } = useTranslation();
  const ownerNames = workspace.owners
    .map((owner) => owner.name || owner.email)
    .join(", ");

  return (
    <TableRow>
      <TableCell className="ps-6 py-3">
        <div className="min-w-0">
          <span className="block max-w-64 truncate text-sm font-medium">
            {workspace.name}
          </span>
          <span className="block max-w-64 truncate text-xs text-muted-foreground">
            {workspace.slug}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3">
        {workspace.owners.length > 0 ? (
          <span
            className="block max-w-56 truncate text-sm"
            title={workspace.owners.map((owner) => owner.email).join(", ")}
          >
            {ownerNames}
          </span>
        ) : (
          <Badge variant="warning">
            {t("settings:adminWorkspaces.noOwner")}
          </Badge>
        )}
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
        {workspace.memberCount}
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
        {workspace.projectCount}
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
        {formatDateMedium(workspace.createdAt)}
      </TableCell>
      <TableCell className="pe-6 py-3 text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("settings:adminWorkspaces.manageLabel", {
            name: workspace.name,
          })}
          onClick={onManage}
        >
          {t("settings:adminWorkspaces.manage")}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default WorkspaceTableRow;
