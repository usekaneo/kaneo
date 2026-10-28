import { INSTANCE_ROLE_NAME_PATTERN } from "@kaneo/permissions";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminRole, AdminRoleValues } from "@/fetchers/admin/role-types";
import useCreateAdminRole from "@/hooks/mutations/admin/use-create-admin-role";
import useUpdateAdminRole from "@/hooks/mutations/admin/use-update-admin-role";
import { RolePermissionFields } from "./role-permission-fields";

type RoleDialogProps = {
  open: boolean;
  /** The role to edit, or null to create one. */
  role: AdminRole | null;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_VALUES: AdminRoleValues = { name: "", permissions: [] };

export function RoleDialog({ open, role, onOpenChange }: RoleDialogProps) {
  const { t } = useTranslation();
  // The parent remounts the dialog for each role it opens.
  const [values, setValues] = useState<AdminRoleValues>(() =>
    role ? { name: role.name, permissions: role.permissions } : EMPTY_VALUES,
  );
  const create = useCreateAdminRole();
  const update = useUpdateAdminRole();
  const isPending = create.isPending || update.isPending;

  const name = values.name.trim();
  const isNameValid = INSTANCE_ROLE_NAME_PATTERN.test(name);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isNameValid) return;
    const request = { name, permissions: values.permissions };
    try {
      if (role) await update.mutateAsync({ roleId: role.id, ...request });
      else await create.mutateAsync(request);
      onOpenChange(false);
    } catch {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {role
                ? t("settings:adminRoles.dialog.editTitle")
                : t("settings:adminRoles.dialog.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-5">
              <Field>
                <FieldLabel htmlFor="admin-role-name">
                  {t("settings:adminRoles.dialog.name")}
                </FieldLabel>
                <Input
                  id="admin-role-name"
                  name="name"
                  required
                  autoComplete="off"
                  maxLength={32}
                  placeholder="support"
                  aria-invalid={name !== "" && !isNameValid}
                  value={values.name}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      name: event.target.value.toLowerCase(),
                    }))
                  }
                />
                {name !== "" && !isNameValid ? (
                  <p className="text-xs text-destructive-foreground">
                    {t("settings:adminRoles.dialog.nameHint")}
                  </p>
                ) : null}
              </Field>
              <RolePermissionFields
                value={values.permissions}
                disabled={isPending}
                onChange={(permissions) =>
                  setValues((current) => ({ ...current, permissions }))
                }
              />
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending || !isNameValid}>
              {role
                ? t("settings:adminRoles.dialog.save")
                : t("settings:adminRoles.dialog.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
