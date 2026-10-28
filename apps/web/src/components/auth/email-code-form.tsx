import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
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
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { AuthCaptcha } from "./auth-captcha";
import {
  authFieldClassName,
  authLabelClassName,
  authMessageClassName,
} from "./auth-form-styles";
import type { AuthCaptcha as AuthCaptchaState } from "./use-auth-captcha";

type EmailCodeFormValues = { name: string; email: string };

type EmailCodeFormProps = {
  withName?: boolean;
  defaultEmail?: string;
  captcha: AuthCaptchaState;
  disabled?: boolean;
  onSent: (values: { email: string; name?: string }) => void;
};

export function EmailCodeForm({
  withName = false,
  defaultEmail,
  captcha,
  disabled = false,
  onSent,
}: EmailCodeFormProps) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        name: withName
          ? z.string().trim().min(1, t("auth:forms.nameRequired"))
          : z.string(),
        email: z.email(t("auth:forms.invalidEmail")),
      }),
    [t, withName],
  );
  const form = useForm<EmailCodeFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { name: "", email: defaultEmail ?? "" },
  });

  const onSubmit = async ({ name, email }: EmailCodeFormValues) => {
    if (captcha.pending) return;
    setIsPending(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp(
        { email, type: "sign-in" },
        { headers: captcha.headers },
      );
      if (result.error) {
        if (result.error.code === "DISPOSABLE_EMAIL_NOT_ALLOWED") {
          form.setError("email", { message: t("auth:forms.disposableEmail") });
        } else {
          toast.error(result.error.message || t("auth:otpSignIn.sendFailed"));
        }
        return;
      }
      onSent({ email, name: withName ? name.trim() : undefined });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("auth:otpSignIn.sendFailed"),
      );
    } finally {
      setIsPending(false);
      captcha.reset();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={withName ? "flex flex-col gap-4" : "flex flex-col gap-3"}
        noValidate
      >
        {withName ? (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className={authFieldClassName}>
                <FormLabel className={authLabelClassName}>
                  {t("auth:forms.name")}
                </FormLabel>
                <FormControl>
                  <Input
                    size="lg"
                    autoComplete="name"
                    placeholder={t("auth:forms.namePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage className={authMessageClassName} />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className={authFieldClassName}>
              <FormLabel className={authLabelClassName}>
                {t("auth:forms.email")}
              </FormLabel>
              <FormControl>
                <Input
                  size="lg"
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth:forms.emailPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage className={authMessageClassName} />
            </FormItem>
          )}
        />
        <AuthCaptcha captcha={captcha} />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          disabled={disabled || captcha.pending}
        >
          {t("auth:forms.continueWithEmail")}
        </Button>
      </form>
    </Form>
  );
}
