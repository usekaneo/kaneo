import { InfoIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import useCreateAdminUser from "@/hooks/mutations/admin/use-create-admin-user";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import {
  buildCreateUserRequest,
  EMPTY_CREATE_USER_VALUES,
} from "./create-user-values";
import { getAccountSetupMode } from "./get-account-setup-mode";
import { InstanceRoleSelect } from "./instance-role-select";

const SETUP_HINT_KEYS = {
  email: "settings:adminUsers.create.hintEmail",
  noEmail: "settings:adminUsers.create.hintNoEmail",
  sso: "settings:adminUsers.create.hintSso",
} as const;

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateUserDialog({
  open,
  onOpenChange,
}: CreateUserDialogProps) {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const [values, setValues] = useState(EMPTY_CREATE_USER_VALUES);
  const { mutateAsync: createUser, isPending } = useCreateAdminUser();
  const mode = getAccountSetupMode(config);
  const [nameError, setNameError] = useState(false);

  const close = () => {
    onOpenChange(false);
    setValues(EMPTY_CREATE_USER_VALUES);
    setNameError(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = buildCreateUserRequest(values);
    if (!request) {
      setNameError(!values.name.trim());
      return;
    }
    try {
      await createUser(request);
      close();
    } catch {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (!isPending) close();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("settings:adminUsers.create.title")}</DialogTitle>
            <DialogDescription>
              {t("settings:adminUsers.create.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              <Field invalid={nameError}>
                <FieldLabel htmlFor="admin-create-user-name">
                  {t("settings:adminUsers.edit.name")}
                </FieldLabel>
                <Input
                  id="admin-create-user-name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  required
                  maxLength={200}
                  value={values.name}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }));
                    setNameError(false);
                  }}
                />
                {nameError ? (
                  <FieldError match>
                    {t("settings:adminUsers.create.nameRequired")}
                  </FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-create-user-email">
                  {t("settings:adminUsers.edit.email")}
                </FieldLabel>
                <Input
                  id="admin-create-user-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  required
                  maxLength={254}
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
                <FieldLabel htmlFor="admin-create-user-role">
                  {t("settings:adminUsers.edit.role")}
                </FieldLabel>
                <InstanceRoleSelect
                  id="admin-create-user-role"
                  value={values.role}
                  onValueChange={(role) =>
                    setValues((current) => ({ ...current, role }))
                  }
                />
              </Field>
              <Alert variant={mode === "noEmail" ? "warning" : "default"}>
                <InfoIcon />
                <AlertDescription>{t(SETUP_HINT_KEYS[mode])}</AlertDescription>
              </Alert>
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
                ? t("settings:adminUsers.create.creating")
                : t("settings:adminUsers.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
