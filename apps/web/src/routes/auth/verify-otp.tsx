import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/auth/verify-otp")({
  component: VerifyOtp,
  validateSearch: (search: Record<string, unknown>) => ({
    email: search.email as string,
    invitationId: search.invitationId as string | undefined,
    redirect: search.redirect as string | undefined,
  }),
});

function VerifyOtp() {
  const { t } = useTranslation();
  const { history } = useRouter();
  const { email, invitationId, redirect } = useSearch({
    from: "/auth/verify-otp",
  });
  const [isPending, setIsPending] = useState(false);

  const verifyOtpSchema = useMemo(
    () =>
      z.object({
        otp: z.string().length(6, t("auth:verifyOtp.validation.codeLength")),
      }),
    [t],
  );

  type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

  const form = useForm<VerifyOtpFormValues>({
    resolver: standardSchemaResolver(verifyOtpSchema),
    defaultValues: { otp: "" },
  });

  const safeRedirect = useMemo(() => {
    if (redirect?.startsWith("/") && !redirect.includes("//")) {
      return redirect;
    }
    return undefined;
  }, [redirect]);

  const onSubmit = useCallback(
    async (data: VerifyOtpFormValues) => {
      setIsPending(true);
      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: data.otp,
        });

        if (result.error) {
          toast.error(
            result.error.message || t("auth:verifyOtp.toast.invalidCode"),
          );
          return;
        }

        toast.success(t("auth:verifyOtp.toast.signedInSuccess"));
        if (safeRedirect) {
          history.push(safeRedirect);
        } else if (invitationId) {
          history.push(`/invitation/accept/${invitationId}`);
        } else {
          history.push("/dashboard");
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("auth:verifyOtp.toast.verifyFailed"),
        );
      } finally {
        setIsPending(false);
      }
    },
    [email, invitationId, history, safeRedirect, t],
  );

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "otp" && value.otp?.length === 6 && !isPending) {
        form.handleSubmit(onSubmit)();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isPending, onSubmit]);

  const handleResendOtp = async () => {
    setIsPending(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        toast.error(
          result.error.message || t("auth:verifyOtp.toast.resendFailed"),
        );
        return;
      }

      toast.success(t("auth:verifyOtp.toast.resendSuccess"));
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth:verifyOtp.toast.resendFailed"),
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:verifyOtp.pageTitle")} />
      <AuthLayout
        title={t("auth:verifyOtp.title")}
        subtitle={t("auth:verifyOtp.subtitle")}
      >
        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              {t("auth:verifyOtp.codeSentTo", { email })}
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="otp"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium sr-only">
                      {t("auth:verifyOtp.verificationCodeLabel")}
                    </FormLabel>
                    <FormControl>
                      <InputOTP
                        maxLength={6}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        pattern={REGEXP_ONLY_DIGITS}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        name="one-time-code"
                      >
                        <InputOTPGroup className="grid w-full grid-cols-6 gap-1.5">
                          <InputOTPSlot className="h-11 w-full" index={0} />
                          <InputOTPSlot className="h-11 w-full" index={1} />
                          <InputOTPSlot className="h-11 w-full" index={2} />
                          <InputOTPSlot className="h-11 w-full" index={3} />
                          <InputOTPSlot className="h-11 w-full" index={4} />
                          <InputOTPSlot className="h-11 w-full" index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage>{fieldState.error?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isPending} className="w-full">
                {isPending
                  ? t("auth:verifyOtp.verifying")
                  : t("auth:verifyOtp.verifyAndSignIn")}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => history.push("/auth/sign-in")}
                  className="w-full"
                >
                  <ArrowLeft className="size-4" />
                  {t("auth:verifyOtp.changeEmail")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendOtp}
                  disabled={isPending}
                  className="w-full"
                >
                  <RefreshCcw className="size-4" />
                  {t("auth:verifyOtp.resend")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </AuthLayout>
    </>
  );
}
