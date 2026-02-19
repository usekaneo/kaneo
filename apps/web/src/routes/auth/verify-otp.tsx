import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
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
      <AuthLayout title="Enter verification code">
        <div className="mt-4">
          <div className="text-center space-y-2 mb-6">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to
            </p>
            <p className="text-sm font-medium">{email}</p>
          </div>

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
                      >
                        <InputOTPGroup className="w-full justify-center items-center">
                          <InputOTPSlot className="size-10" index={0} />
                          <InputOTPSlot className="size-10" index={1} />
                          <InputOTPSlot className="size-10" index={2} />
                          <InputOTPSlot className="size-10" index={3} />
                          <InputOTPSlot className="size-10" index={4} />
                          <InputOTPSlot className="size-10" index={5} />
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

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => history.push("/auth/sign-in")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isPending}
                  className="text-primary hover:underline"
                >
                  Resend code
                </button>
              </div>
            </form>
          </Form>
        </div>
      </AuthLayout>
    </>
  );
}
