import { ShieldPlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { DirectoryHeading } from "@/components/admin/directory/directory-heading";
import { DirectorySkeletonRows } from "@/components/admin/directory/directory-skeleton-rows";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import type { AdminRole } from "@/fetchers/admin/role-types";
import useDeleteAdminRole from "@/hooks/mutations/admin/use-delete-admin-role";
import useAdminRoles from "@/hooks/queries/admin/use-admin-roles";
import { RoleDialog } from "./role-dialog";
import { RoleRow } from "./role-row";

type DialogState = { key: number; role: AdminRole | null } | null;

function RolesPanel() {
  const { t } = useTranslation();
  const { data: roles, isLoading, isError, refetch } = useAdminRoles();
  const deleteRole = useDeleteAdminRole();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminRole | null>(null);

  const openDialog = (role: AdminRole | null) => {
    setDialog({ key: (dialog?.key ?? 0) + 1, role });
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteRole.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      return;
    }
  };

  return (
    <SettingsPage
      title={t("settings:adminRoles.title")}
      actions={
        <Button type="button" size="sm" onClick={() => openDialog(null)}>
          <ShieldPlusIcon aria-hidden="true" />
          {t("settings:adminRoles.create")}
        </Button>
      }
    >
      <SettingsSection
        title={
          <DirectoryHeading
            title={t("settings:adminRoles.listTitle")}
            count={roles ? roles.length + 2 : undefined}
          />
        }
      >
        <SettingsCard>
          {isError ? (
            <DirectoryErrorRow
              message={t("settings:adminRoles.loadError")}
              retryLabel={t("settings:adminUsers.retry")}
              onRetry={() => refetch()}
            />
          ) : (
            <div
              role="list"
              aria-label={t("settings:adminRoles.listTitle")}
              className="divide-y divide-border"
            >
              <RoleRow
                name="admin"
                label={t("settings:adminUsers.roles.admin")}
                builtIn
                permissionLabel={t("settings:adminRoles.allPermissions")}
              />
              <RoleRow
                name="user"
                label={t("settings:adminUsers.roles.user")}
                builtIn
                permissionLabel={t("settings:adminRoles.noPermissions")}
              />
              {isLoading ? <DirectorySkeletonRows rows={2} /> : null}
              {roles?.map((role) => (
                <RoleRow
                  key={role.id}
                  name={role.name}
                  label={role.name}
                  builtIn={false}
                  permissionLabel={t("settings:adminRoles.permissionCount", {
                    count: role.permissions.length,
                  })}
                  userCount={role.userCount}
                  onEdit={() => openDialog(role)}
                  onDelete={() => setDeleting(role)}
                />
              ))}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {dialog ? (
        <RoleDialog
          key={dialog.key}
          open={isDialogOpen}
          role={dialog.role}
          onOpenChange={setIsDialogOpen}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deleteRole.isPending) setDeleting(null);
        }}
        title={t("settings:adminRoles.deleteTitle", {
          name: deleting?.name ?? "",
        })}
        confirmLabel={t("common:actions.delete")}
        pending={deleteRole.isPending}
        onConfirm={confirmDelete}
      />
    </SettingsPage>
  );
}

export default RolesPanel;
