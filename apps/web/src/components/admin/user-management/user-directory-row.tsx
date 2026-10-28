import {
  BadgeCheckIcon,
  BanIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  MonitorSmartphoneIcon,
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
import type { InstancePermission } from "@kaneo/permissions";
import { getPrimaryInstanceRole } from "./get-primary-instance-role";
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
  /** The viewer's instance permissions. */
  permissions: readonly InstancePermission[];
  /** False when the user holds permissions the viewer lacks. */
  canManage: boolean;
  onEdit: () => void;
  onAction: (type: UserActionType) => void;
  onOpenSecurity: () => void;
};

const CELL_CLASS = "hidden shrink-0 sm:flex";

export function UserDirectoryRow({
  user,
  isSelf,
  canSendPasswordReset,
  permissions,
  canManage,
  onEdit,
  onOpenSecurity,
  onAction,
}: UserDirectoryRowProps) {
  const { t } = useTranslation();
  const role = getPrimaryInstanceRole(user.role);
  const isDeactivated = user.banned === true;
  const can = (permission: InstancePermission) =>
    canManage && permissions.includes(permission);

  const actions: RowAction[] = [
    ...(can("users:update")
      ? [
          {
            id: "edit",
            label: t("settings:adminUsers.actions.edit"),
            icon: PencilIcon,
            onSelect: onEdit,
          },
        ]
      : []),
    ...(can("users:sessions") || can("users:api_keys")
      ? [
          {
            id: "security",
            label: t("settings:adminUsers.actions.security"),
            icon: MonitorSmartphoneIcon,
            onSelect: onOpenSecurity,
          },
        ]
      : []),
    ...(canManage
      ? getUserActionTypes(user, {
          isSelf,
          canSendPasswordReset,
          permissions,
        })
      : []
    ).map((type) => ({
      id: type,
      label: t(USER_ACTION_COPY[type].menu),
      icon: ACTION_ICONS[type],
      destructive: type === "delete",
      onSelect: () => onAction(type),
    })),
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
            <UserRoleBadge role={role} />
            <UserStatus isDeactivated={isDeactivated} />
          </div>
        </div>
      </div>
      <div role="cell" className={cn(CELL_CLASS, USER_DIRECTORY_COLUMNS.role)}>
        <UserRoleBadge role={role} />
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
        {actions.length > 0 ? (
          <RowActionsMenu
            label={t("settings:adminUsers.actions.open", { name: user.name })}
            actions={actions}
          />
        ) : null}
      </div>
    </div>
  );
}
