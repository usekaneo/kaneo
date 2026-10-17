import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { KeyRoundIcon } from "lucide-react";
import { useMemo } from "react";
import { type Path, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  type ChangePasswordFormValues,
  createChangePasswordSchema,
} from "@/components/account/change-password/create-change-password-schema";
import { PasswordInput } from "@/components/account/change-password/password-input";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import useChangePassword from "@/hooks/mutations/use-change-password";
import { toast } from "@/lib/toast";

const EMPTY_VALUES: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELDS: Array<{
  name: Path<ChangePasswordFormValues>;
  labelKey: string;
  placeholderKey: string;
  autoComplete: string;
}> = [
  {
    name: "currentPassword",
    labelKey: "settings:securityPage.currentPassword",
    placeholderKey: "settings:securityPage.currentPasswordPlaceholder",
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    labelKey: "settings:securityPage.newPassword",
    placeholderKey: "settings:securityPage.newPasswordPlaceholder",
    autoComplete: "new-password",
  },
  {
    name: "confirmPassword",
    labelKey: "settings:securityPage.confirmPassword",
    placeholderKey: "settings:securityPage.confirmPasswordPlaceholder",
    autoComplete: "new-password",
  },
];

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: changePassword, isPending } = useChangePassword();
  const schema = useMemo(() => createChangePasswordSchema(t), [t]);
  const form = useForm<ChangePasswordFormValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: EMPTY_VALUES,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(EMPTY_VALUES);
    onOpenChange(next);
  };

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(t("settings:securityPage.updateSuccess"), {
        icon: KeyRoundIcon,
      });
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:securityPage.updateError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings:securityPage.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings:securityPage.dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-col"
          >
            <DialogPanel className="space-y-4">
              {FIELDS.map((item) => (
                <FormField
                  key={item.name}
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(item.labelKey)}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          field={field}
                          autoComplete={item.autoComplete}
                          placeholder={t(item.placeholderKey)}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              ))}
            </DialogPanel>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                  />
                }
              >
                {t("common:actions.cancel")}
              </DialogClose>
              <Button
                type="submit"
                disabled={!form.formState.isValid || isPending}
              >
                {isPending
                  ? t("settings:securityPage.submitting")
                  : t("settings:securityPage.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
