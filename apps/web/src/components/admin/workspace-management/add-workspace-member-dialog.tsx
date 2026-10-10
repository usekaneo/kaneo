import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import useAddAdminWorkspaceMember from "@/hooks/mutations/admin/use-add-admin-workspace-member";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import InstanceUserCombobox from "./instance-user-combobox";
import WorkspaceRoleSelect from "./workspace-role-select";

const DEFAULT_ROLE = "member";

type Props = {
  workspace: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberIds: ReadonlySet<string>;
  roleOptions: readonly string[];
};

function AddWorkspaceMemberDialog({
  workspace,
  open,
  onOpenChange,
  memberIds,
  roleOptions,
}: Props) {
  const { t } = useTranslation();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [wasOpen, setWasOpen] = useState(open);
  const { mutateAsync: addMember, isPending } = useAddAdminWorkspaceMember();

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setUser(null);
      setRole(DEFAULT_ROLE);
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace || !user) return;

    try {
      await addMember({ workspaceId: workspace.id, userId: user.id, role });
      onOpenChange(false);
    } catch {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !isPending) onOpenChange(next);
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("settings:adminWorkspaces.addMember.title")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:adminWorkspaces.addMember.description", {
                name: workspace?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="admin-workspace-add-user">
                  {t("settings:adminWorkspaces.addMember.user")}
                </FieldLabel>
                <InstanceUserCombobox
                  id="admin-workspace-add-user"
                  value={user}
                  onValueChange={setUser}
                  memberIds={memberIds}
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-workspace-add-role">
                  {t("settings:adminWorkspaces.addMember.role")}
                </FieldLabel>
                <WorkspaceRoleSelect
                  id="admin-workspace-add-role"
                  value={role}
                  options={roleOptions}
                  onValueChange={setRole}
                  disabled={isPending}
                />
              </Field>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="ghost" />}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={!user || isPending}>
              {isPending
                ? t("settings:adminWorkspaces.addMember.adding")
                : t("settings:adminWorkspaces.addMember.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export default AddWorkspaceMemberDialog;
