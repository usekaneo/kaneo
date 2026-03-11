import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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

const verifyOtpSchema = z.object({
  otp: z.string().length(6, "Code must be 6 digits"),
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export const Route = createFileRoute("/auth/verify-otp")({
  component: VerifyOtp,
  validateSearch: (search: Record<string, unknown>) => ({
    email: search.email as string,
    invitationId: search.invitationId as string | undefined,
  }),
});

function VerifyOtp() {
  const { history } = useRouter();
  const { email, invitationId } = useSearch({ from: "/auth/verify-otp" });
  const [isPending, setIsPending] = useState(false);

  const form = useForm<VerifyOtpFormValues>({
    resolver: standardSchemaResolver(verifyOtpSchema),
    defaultValues: { otp: "" },
  });

  const onSubmit = useCallback(
    async (data: VerifyOtpFormValues) => {
      setIsPending(true);
      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: data.otp,
        });

        if (result.error) {
          toast.error(result.error.message || "Invalid verification code");
          return;
        }

        toast.success("Signed in successfully!");
        if (invitationId) {
          history.push(`/invitation/accept/${invitationId}`);
        } else {
          history.push("/dashboard");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to verify code",
        );
      } finally {
        setIsPending(false);
      }
    },
    [email, invitationId, history],
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
        toast.error(result.error.message || "Failed to resend code");
        return;
      }

      toast.success("New verification code sent!");
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend code",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title="Verify Code" />
      <AuthLayout
        title="Enter verification code"
        subtitle="Use the 6-digit code sent to your email to continue"
      >
        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              Code sent to{" "}
              <span className="font-mono text-foreground">{email}</span>
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
                      Verification Code
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
                {isPending ? "Verifying..." : "Verify & Sign In"}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => history.push("/auth/sign-in")}
                  className="w-full"
                >
                  <ArrowLeft className="size-4" />
                  Change email
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResendOtp}
                  disabled={isPending}
                  className="w-full"
                >
                  <RefreshCcw className="size-4" />
                  Resend
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </AuthLayout>
    </>
  );
}
