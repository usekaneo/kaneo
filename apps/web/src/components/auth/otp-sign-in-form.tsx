import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
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

type OtpSignInFormProps = {
  invitationId?: string;
  defaultEmail?: string;
  onSuccess?: () => void;
};

const emailSchema = z.object({
  email: z.email(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export function OtpSignInForm({
  invitationId,
  defaultEmail,
}: OtpSignInFormProps) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);
  const { history } = useRouter();

  const form = useForm<EmailFormValues>({
    resolver: standardSchemaResolver(emailSchema),
    defaultValues: { email: defaultEmail || "" },
  });

  const onSubmit = async (data: EmailFormValues) => {
    setIsPending(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: data.email,
        type: "sign-in",
      });

      if (result.error) {
        toast.error(result.error.message || t("auth:otpSignIn.sendFailed"));
        return;
      }

      toast.success(t("auth:otpSignIn.codeSent"));

      const searchParams = new URLSearchParams({
        email: data.email,
        ...(invitationId && { invitationId }),
      });
      history.push(`/auth/verify-otp?${searchParams.toString()}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">
                {t("auth:forms.email")}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("auth:forms.emailPlaceholder")}
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full mt-4">
          {isPending
            ? t("auth:otpSignIn.sending")
            : t("auth:otpSignIn.sendVerificationCode")}
        </Button>
      </form>
    </Form>
  );
}
