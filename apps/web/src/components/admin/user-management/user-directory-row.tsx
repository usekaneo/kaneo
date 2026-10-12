import {
  BanIcon,
  CheckCircle2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DirectoryAvatar } from "@/components/admin/directory/directory-avatar";
import {
  type RowAction,
  RowActionsMenu,
} from "@/components/settings/row-actions-menu";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { hasInstanceAdminRole } from "@/lib/instance-admin";
import type { PendingUserAction } from "./pending-user-action";
import { USER_DIRECTORY_COLUMNS } from "./user-directory-columns";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatus } from "./user-status";

type UserDirectoryRowProps = {
  user: AdminUser;
  isSelf: boolean;
  onEdit: () => void;
  onAction: (type: PendingUserAction["type"]) => void;
};

const CELL_CLASS = "hidden shrink-0 sm:flex";

export function UserDirectoryRow({
  user,
  isSelf,
  onEdit,
  onAction,
}: UserDirectoryRowProps) {
  const { t } = useTranslation();
  const isAdmin = hasInstanceAdminRole(user.role);
  const isDeactivated = user.banned === true;

  const actions: RowAction[] = [
    {
      id: "edit",
      label: t("settings:adminUsers.actions.edit"),
      icon: PencilIcon,
      onSelect: onEdit,
    },
  ];
  if (!isSelf) {
    actions.push(
      isDeactivated
        ? {
            id: "reactivate",
            label: t("settings:adminUsers.actions.reactivate"),
            icon: CheckCircle2Icon,
            onSelect: () => onAction("reactivate"),
          }
        : {
            id: "deactivate",
            label: t("settings:adminUsers.actions.deactivate"),
            icon: BanIcon,
            onSelect: () => onAction("deactivate"),
          },
      {
        id: "delete",
        label: t("common:actions.delete"),
        icon: Trash2Icon,
        destructive: true,
        onSelect: () => onAction("delete"),
      },
    );
  }

  return (
    <div role="row" className="flex items-center gap-4 px-4 py-3">
      <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
        <DirectoryAvatar name={user.name} image={user.image} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{user.name}</span>
            {isSelf ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("settings:adminUsers.you")}
              </span>
            ) : null}
          </div>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
          <div className="mt-1.5 flex items-center gap-2 sm:hidden">
            <UserRoleBadge isAdmin={isAdmin} />
            <UserStatus isDeactivated={isDeactivated} />
          </div>
        </div>
      </div>
      <div role="cell" className={cn(CELL_CLASS, USER_DIRECTORY_COLUMNS.role)}>
        <UserRoleBadge isAdmin={isAdmin} />
      </div>
      <div
        role="cell"
        className={cn(CELL_CLASS, USER_DIRECTORY_COLUMNS.status)}
      >
        <UserStatus isDeactivated={isDeactivated} />
      </div>
      <div
        role="cell"
        className={cn(
          CELL_CLASS,
          USER_DIRECTORY_COLUMNS.joined,
          "text-[13px] text-muted-foreground tabular-nums",
        )}
      >
        {formatDateMedium(user.createdAt)}
      </div>
      <div
        role="cell"
        className={cn(
          "flex shrink-0 justify-end",
          USER_DIRECTORY_COLUMNS.actions,
        )}
      >
        <RowActionsMenu
          label={t("settings:adminUsers.actions.open", { name: user.name })}
          actions={actions}
        />
      </div>
    </div>
  );
}
