import {
  CrownIcon,
  EllipsisIcon,
  PencilIcon,
  ShieldIcon,
  UserMinusIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProjectAccessValue } from "@/components/team/project-access/project-access-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { AdminWorkspaceMember } from "@/fetchers/admin/workspace-types";
import { formatDateMedium } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { isWorkspaceOwnerRole } from "./is-workspace-owner-role";
import WorkspaceRoleSelect from "./workspace-role-select";

type Props = {
  member: AdminWorkspaceMember;
  roleOptions: readonly string[];
  access: ProjectAccessValue | undefined;
  isOnlyOwner: boolean;
  isUpdatingRole: boolean;
  onRoleChange: (role: string) => void;
  onEditAccess: () => void;
  onMakeOwner: () => void;
  onRemove: () => void;
};

function WorkspaceMemberRow({
  member,
  roleOptions,
  access,
  isOnlyOwner,
  isUpdatingRole,
  onRoleChange,
  onEditAccess,
  onMakeOwner,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const isOwner = isWorkspaceOwnerRole(member.role);
  const name = member.name || member.email;
  const accessLabel = access
    ? access.projectAccess === "all"
      ? t("team:projectAccess.allProjects")
      : t("team:projectAccess.projectCount", {
          count: access.projectIds.length,
        })
    : null;

  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8 border bg-muted">
            {member.image ? (
              <AvatarImage src={member.image} alt={name} />
            ) : null}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(member.name, "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="block max-w-56 truncate text-sm font-medium">
              {name}
            </span>
            <span className="block max-w-56 truncate text-xs text-muted-foreground">
              {member.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        {isOwner ? (
          <Badge variant="outline" className="gap-1">
            <ShieldIcon aria-hidden="true" />
            {t("team:roles.owner")}
          </Badge>
        ) : (
          <WorkspaceRoleSelect
            size="sm"
            className="w-36"
            label={t("settings:adminWorkspaces.members.roleLabel", { name })}
            value={member.role}
            options={roleOptions}
            disabled={isUpdatingRole}
            onValueChange={(role) => {
              if (role !== member.role) onRoleChange(role);
            }}
          />
        )}
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground">
        {isOwner ? (
          t("team:projectAccess.allProjects")
        ) : accessLabel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            aria-label={t("settings:adminWorkspaces.members.editAccess", {
              name,
              access: accessLabel,
            })}
            onClick={onEditAccess}
          >
            {accessLabel}
            <PencilIcon aria-hidden="true" />
          </Button>
        ) : (
          "–"
        )}
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
        {formatDateMedium(member.joinedAt)}
      </TableCell>
      <TableCell className="py-3 text-right">
        {isOnlyOwner ? null : (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("settings:adminWorkspaces.members.actions", {
                    name,
                  })}
                />
              }
            >
              <EllipsisIcon aria-hidden="true" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem closeOnClick onClick={onMakeOwner}>
                <CrownIcon aria-hidden="true" />
                {t("settings:adminWorkspaces.members.makeOwner")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem closeOnClick variant="destructive" onClick={onRemove}>
                <UserMinusIcon aria-hidden="true" />
                {t("settings:adminWorkspaces.members.remove")}
              </MenuItem>
            </MenuPopup>
          </Menu>
        )}
      </TableCell>
    </TableRow>
  );
}

export default WorkspaceMemberRow;
