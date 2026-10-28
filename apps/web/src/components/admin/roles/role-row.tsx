import { Link } from "@tanstack/react-router";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { Badge } from "@/components/ui/badge";

type RoleRowProps = {
  name: string;
  label: string;
  builtIn: boolean;
  permissionLabel: string;
  /** Unknown for built-in roles, which aren't counted. */
  userCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function RoleRow({
  name,
  label,
  builtIn,
  permissionLabel,
  userCount,
  onEdit,
  onDelete,
}: RoleRowProps) {
  const { t } = useTranslation();

  return (
    <div role="listitem" className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{label}</span>
          {builtIn ? (
            <Badge variant="secondary" className="shrink-0 px-1.5">
              {t("settings:adminRoles.builtIn")}
            </Badge>
          ) : null}
        </div>
        <span className="block truncate text-xs text-muted-foreground">
          {permissionLabel}
        </span>
      </div>
      <Link
        to="/dashboard/settings/admin/users"
        search={{ role: name }}
        className="shrink-0 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {userCount === undefined
          ? t("settings:adminRoles.viewUsers")
          : t("settings:adminRoles.userCount", { count: userCount })}
      </Link>
      <div className="flex w-7 shrink-0 justify-end">
        {onEdit && onDelete ? (
          <RowActionsMenu
            label={t("settings:adminRoles.actions", { name: label })}
            actions={[
              {
                id: "edit",
                label: t("settings:adminRoles.edit"),
                icon: PencilIcon,
                onSelect: onEdit,
              },
              {
                id: "delete",
                label: t("common:actions.delete"),
                icon: Trash2Icon,
                destructive: true,
                onSelect: onDelete,
              },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}
