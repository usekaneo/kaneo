import { CrownIcon, ShieldIcon, UserMinusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DirectoryAvatar } from "@/components/admin/directory/directory-avatar";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import type { ProjectAccessValue } from "@/components/team/project-access/project-access-value";
import { Badge } from "@/components/ui/badge";
import type { AdminWorkspaceMember } from "@/fetchers/admin/workspace-types";
import { isWorkspaceOwnerRole } from "./is-workspace-owner-role";
import { MemberAccessButton } from "./member-access-button";
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

  return (
    <div
      role="listitem"
      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <DirectoryAvatar name={name} image={member.image} />
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {member.email}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
          {isOwner ? (
            <Badge variant="outline" className="gap-1 px-1.5">
              <ShieldIcon aria-hidden="true" />
              {t("team:roles.owner")}
            </Badge>
          ) : (
            <WorkspaceRoleSelect
              size="sm"
              className="w-full"
              label={t("settings:adminWorkspaces.members.roleLabel", { name })}
              value={member.role}
              options={roleOptions}
              disabled={isUpdatingRole}
              onValueChange={(role) => {
                if (role !== member.role) onRoleChange(role);
              }}
            />
          )}
        </div>
        <div className="shrink-0 sm:w-28">
          <MemberAccessButton
            name={name}
            isOwner={isOwner}
            access={access}
            onEditAccess={onEditAccess}
          />
        </div>
        <div className="flex w-7 shrink-0 justify-end">
          {isOnlyOwner ? null : (
            <RowActionsMenu
              label={t("settings:adminWorkspaces.members.actions", { name })}
              actions={[
                {
                  id: "make-owner",
                  label: t("settings:adminWorkspaces.members.makeOwner"),
                  icon: CrownIcon,
                  onSelect: onMakeOwner,
                },
                {
                  id: "remove",
                  label: t("settings:adminWorkspaces.members.remove"),
                  icon: UserMinusIcon,
                  destructive: true,
                  onSelect: onRemove,
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkspaceMemberRow;
