import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  type ControllerRenderProps,
  type FieldValues,
  type Path,
  useForm,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useChangePassword from "@/hooks/mutations/use-change-password";
import useListAccounts from "@/hooks/queries/use-list-accounts";
import { toast } from "@/lib/toast";

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// A local password input so the show/hide toggle isn't copy-pasted three times.
function PasswordInput<T extends FieldValues>({
  field,
  autoComplete,
  placeholder,
}: {
  field: ControllerRenderProps<T, Path<T>>;
  autoComplete: string;
  placeholder: string;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        {...field}
      />
      <button
        type="button"
        onClick={() => setShow((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={
          show ? t("auth:forms.hidePassword") : t("auth:forms.showPassword")
        }
        aria-pressed={show}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function ChangePasswordSettings() {
  const { t } = useTranslation();
  const { data: accounts, isLoading, isError } = useListAccounts();
  const { mutateAsync: changePassword, isPending } = useChangePassword();

  const hasPassword =
    accounts?.some((account) => account.providerId === "credential") ?? false;

  const changePasswordSchema = z
    .object({
      currentPassword: z
        .string()
        .min(1, t("settings:securityPage.validation.currentRequired")),
      newPassword: z
        .string()
        .min(8, t("settings:securityPage.validation.tooShort")),
      confirmPassword: z
        .string()
        .min(1, t("settings:securityPage.validation.confirmRequired")),
    })
    .refine((values) => values.newPassword !== values.currentPassword, {
      message: t("settings:securityPage.validation.sameAsCurrent"),
      path: ["newPassword"],
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t("settings:securityPage.validation.mismatch"),
      path: ["confirmPassword"],
    });

  const form = useForm<ChangePasswordFormValues>({
    resolver: standardSchemaResolver(changePasswordSchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset();
      toast.success(t("settings:securityPage.updateSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:securityPage.updateError"),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-md font-medium">
          {t("settings:securityPage.sectionTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("settings:securityPage.sectionSubtitle")}
        </p>
      </div>

      <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {t("common:error.messages.unknown")}
          </p>
        ) : hasPassword ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("settings:securityPage.currentPassword")}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        field={field}
                        autoComplete="current-password"
                        placeholder={t(
                          "settings:securityPage.currentPasswordPlaceholder",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("settings:securityPage.newPassword")}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        field={field}
                        autoComplete="new-password"
                        placeholder={t(
                          "settings:securityPage.newPasswordPlaceholder",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("settings:securityPage.confirmPassword")}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        field={field}
                        autoComplete="new-password"
                        placeholder={t(
                          "settings:securityPage.confirmPasswordPlaceholder",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending
                    ? t("settings:securityPage.submitting")
                    : t("settings:securityPage.submit")}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings:securityPage.noPassword.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings:securityPage.noPassword.description")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
