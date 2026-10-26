import {
  BadgeCheckIcon,
  BanIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
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
import {
  formatDateMedium,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/format";
import { hasInstanceAdminRole } from "@/lib/instance-admin";
import { getUserActionTypes } from "./get-user-action-types";
import type { UserActionType } from "./pending-user-action";
import { USER_ACTION_COPY } from "./user-action-copy";
import { USER_DIRECTORY_COLUMNS } from "./user-directory-columns";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatus } from "./user-status";

const ACTION_ICONS: Record<UserActionType, LucideIcon> = {
  sendPasswordReset: KeyRoundIcon,
  sendVerification: MailIcon,
  markEmailVerified: BadgeCheckIcon,
  deactivate: BanIcon,
  reactivate: CheckCircle2Icon,
  delete: Trash2Icon,
};

type UserDirectoryRowProps = {
  user: AdminUser;
  isSelf: boolean;
  canSendPasswordReset: boolean;
  onEdit: () => void;
  onAction: (type: UserActionType) => void;
};

const CELL_CLASS = "hidden shrink-0 sm:flex";

export function UserDirectoryRow({
  user,
  isSelf,
  canSendPasswordReset,
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
    ...getUserActionTypes(user, { isSelf, canSendPasswordReset }).map(
      (type) => ({
        id: type,
        label: t(USER_ACTION_COPY[type].menu),
        icon: ACTION_ICONS[type],
        destructive: type === "delete",
        onSelect: () => onAction(type),
      }),
    ),
  ];

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
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{user.email}</span>
            {user.emailVerified ? null : (
              <span className="shrink-0 text-warning-foreground">
                {t("settings:adminUsers.unverified")}
              </span>
            )}
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
          USER_DIRECTORY_COLUMNS.lastActive,
          "text-[13px] text-muted-foreground tabular-nums",
        )}
      >
        {user.lastActiveAt ? (
          <time
            dateTime={user.lastActiveAt}
            title={formatDateTime(user.lastActiveAt)}
            className="truncate"
          >
            {formatRelativeTime(user.lastActiveAt)}
          </time>
        ) : (
          t("settings:adminUsers.never")
        )}
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
