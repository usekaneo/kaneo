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
import { Input } from "@/components/ui/input";
import useUpdateAdminUser from "@/hooks/mutations/admin/use-update-admin-user";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import {
  buildUserUpdate,
  EMPTY_EDIT_USER_VALUES,
  getEditUserValues,
} from "./edit-user-values";
import { InstanceRoleSelect } from "./instance-role-select";
import { UserAccountFacts } from "./user-account-facts";
import { UserAvatarField } from "./user-avatar-field";

type EditUserDialogProps = {
  user: AdminUser | null;
  currentUserId: string | undefined;
  onClose: () => void;
};

export function EditUserDialog({
  user,
  currentUserId,
  onClose,
}: EditUserDialogProps) {
  const { t } = useTranslation();
  const [previousUser, setPreviousUser] = useState(user);
  const [editedUser, setEditedUser] = useState(user);
  const [values, setValues] = useState(() =>
    user ? getEditUserValues(user) : EMPTY_EDIT_USER_VALUES,
  );
  const { mutateAsync: updateUser, isPending } = useUpdateAdminUser();

  if (user !== previousUser) {
    setPreviousUser(user);
    if (user) {
      setEditedUser(user);
      setValues(getEditUserValues(user));
    }
  }

  const isSelf = editedUser !== null && editedUser.id === currentUserId;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editedUser) return;

    const update = buildUserUpdate(editedUser, values, currentUserId);
    if (!update) return;

    try {
      await updateUser(update);
      onClose();
    } catch {
      return;
    }
  };

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("settings:adminUsers.edit.title")}</DialogTitle>
            <DialogDescription>
              {t("settings:adminUsers.edit.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              {editedUser ? (
                <UserAvatarField key={editedUser.id} user={editedUser} />
              ) : null}
              <Field>
                <FieldLabel htmlFor="admin-user-name">
                  {t("settings:adminUsers.edit.name")}
                </FieldLabel>
                <Input
                  id="admin-user-name"
                  name="name"
                  type="text"
                  required
                  value={values.name}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-user-email">
                  {t("settings:adminUsers.edit.email")}
                </FieldLabel>
                <Input
                  id="admin-user-email"
                  name="email"
                  type="email"
                  required
                  value={values.email}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-user-role">
                  {t("settings:adminUsers.edit.role")}
                </FieldLabel>
                <InstanceRoleSelect
                  id="admin-user-role"
                  value={values.role}
                  disabled={isSelf}
                  onValueChange={(role) =>
                    setValues((current) => ({ ...current, role }))
                  }
                />
                {isSelf ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settings:adminUsers.edit.selfRoleHint")}
                  </p>
                ) : null}
              </Field>
              {editedUser ? <UserAccountFacts user={editedUser} /> : null}
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("settings:adminUsers.edit.saving")
                : t("settings:adminUsers.edit.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
