import {
  createFileRoute,
  Link,
  useLocation,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { MailIcon } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthCaptcha } from "@/components/auth/auth-captcha";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { getSafeRedirectPath } from "@/components/auth/auth-methods";
import { AuthPage } from "@/components/auth/auth-page";
import { useAuthCaptcha } from "@/components/auth/use-auth-captcha";
import { readSignUpName } from "@/components/auth/verify-otp-path";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 5;
const slots = Array.from({ length: CODE_LENGTH }, (_, index) => ({
  id: `slot-${index}`,
  index,
}));

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
  const signUpName = readSignUpName(useLocation().state);
  const captcha = useAuthCaptcha();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const safeRedirect = getSafeRedirectPath(redirect);

  const verify = useCallback(
    async (otp: string) => {
      if (otp.length !== CODE_LENGTH) {
        setError(t("auth:verifyOtp.validation.codeLength"));
        return;
      }
      setIsVerifying(true);
      setError(null);
      try {
        // A first-time OTP sign-in creates the account, so instances with
        // DISABLE_REGISTRATION=true reject it unless the request carries the
        // invitation the visitor arrived with.
        const result = await authClient.signIn.emailOtp(
          signUpName ? { email, otp, name: signUpName } : { email, otp },
          invitationId
            ? { headers: { "x-invitation-id": invitationId } }
            : undefined,
        );
        if (result.error) {
          const messages: Record<string, string> = {
            INVALID_OTP: t("auth:verifyOtp.toast.invalidCode"),
            OTP_EXPIRED: t("auth:verifyOtp.expired"),
            TOO_MANY_ATTEMPTS: t("auth:verifyOtp.tooManyAttempts"),
            DISPOSABLE_EMAIL_NOT_ALLOWED: t("auth:forms.disposableEmail"),
          };
          setError(
            messages[result.error.code ?? ""] ??
              (result.error.message || t("auth:verifyOtp.toast.invalidCode")),
          );
          setIsVerifying(false);
          return;
        }
        history.push(
          safeRedirect ??
            (invitationId
              ? `/invitation/accept/${invitationId}`
              : "/dashboard"),
        );
      } catch (caught) {
        toast.error(
          caught instanceof Error && caught.message
            ? caught.message
            : t("auth:verifyOtp.toast.verifyFailed"),
        );
        setIsVerifying(false);
      }
    },
    [email, history, invitationId, safeRedirect, signUpName, t],
  );

  const resend = async () => {
    if (captcha.pending) return;
    setIsResending(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp(
        { email, type: "sign-in" },
        { headers: captcha.headers },
      );
      if (result.error) {
        toast.error(
          result.error.message || t("auth:verifyOtp.toast.resendFailed"),
        );
        return;
      }
      toast.success(t("auth:verifyOtp.toast.resendSuccess"), {
        icon: MailIcon,
      });
      setCode("");
      setError(null);
    } catch (caught) {
      toast.error(
        caught instanceof Error && caught.message
          ? caught.message
          : t("auth:verifyOtp.toast.resendFailed"),
      );
    } finally {
      setIsResending(false);
      captcha.reset();
    }
  };

  const onChange = (value: string) => {
    setCode(value);
    setError(null);
    if (value.length === CODE_LENGTH && !isVerifying) void verify(value);
  };

  return (
    <>
      <PageTitle title={t("auth:verifyOtp.pageTitle")} />
      <AuthPage
        title={t("auth:verifyOtp.heading")}
        description={t("auth:verifyOtp.description", {
          email,
          minutes: CODE_EXPIRY_MINUTES,
        })}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="verification-code">
              {t("auth:verifyOtp.label")}
            </Label>
            <InputOTP
              id="verification-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={onChange}
              pattern={REGEXP_ONLY_DIGITS}
              autoComplete="one-time-code"
              inputMode="numeric"
              name="one-time-code"
              autoFocus
              disabled={isVerifying}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "verification-code-error" : undefined}
            >
              <InputOTPGroup className="grid w-full grid-cols-6 gap-1.5">
                {slots.map((slot) => (
                  <InputOTPSlot
                    key={slot.id}
                    index={slot.index}
                    className="h-11 w-full text-base dark:bg-input/32"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {error ? (
              <p
                id="verification-code-error"
                role="alert"
                className={authMessageClassName}
              >
                {error}
              </p>
            ) : null}
          </div>
          <AuthCaptcha captcha={captcha} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isVerifying}
          >
            {t("auth:verifyOtp.submit")}
          </Button>
        </form>
        <p className="flex flex-wrap items-center gap-x-1 gap-y-2 pt-8 text-muted-foreground text-sm">
          {t("auth:verifyOtp.didntGetIt")}{" "}
          <button
            type="button"
            className={authLinkClassName}
            disabled={captcha.pending || isResending || isVerifying}
            onClick={resend}
          >
            {t("auth:verifyOtp.resendCode")}
          </button>
          <span aria-hidden="true" className="px-1">
            ·
          </span>
          <Link
            to={signUpName ? "/auth/sign-up" : "/auth/sign-in"}
            search={
              signUpName
                ? { invitationId }
                : { invitationId, redirect: safeRedirect }
            }
            className={authLinkClassName}
          >
            {t("auth:verifyOtp.useDifferentEmail")}
          </Link>
        </p>
      </AuthPage>
    </>
  );
}
