import {
  createFileRoute,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthCaptcha } from "@/components/auth/auth-captcha";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import {
  getEmailMethod,
  getProviders,
  getSafeRedirectPath,
  getSignInFooter,
  getSignInSubtitleKey,
} from "@/components/auth/auth-methods";
import { AuthPage } from "@/components/auth/auth-page";
import { AutoLoginRedirect } from "@/components/auth/auto-login-redirect";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { InvitationNotice } from "@/components/auth/invitation-notice";
import { PasswordSignInForm } from "@/components/auth/password-sign-in-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { SignInFooterLine } from "@/components/auth/sign-in-footer-line";
import { useAuthCaptcha } from "@/components/auth/use-auth-captcha";
import { useGuestSignIn } from "@/components/auth/use-guest-sign-in";
import { useProviderName } from "@/components/auth/use-provider-name";
import { useProviderSignIn } from "@/components/auth/use-provider-sign-in";
import { buildVerifyOtpPath } from "@/components/auth/verify-otp-path";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const signInSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
  validateSearch: signInSearchSchema,
});

function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { history } = useRouter();
  const search = useSearch({ from: "/auth/sign-in" });
  const captcha = useAuthCaptcha();
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const {
    data: instanceStatus,
    isLoading: isInstanceStatusLoading,
    isError: isInstanceStatusError,
    error: instanceStatusError,
  } = useInstanceStatus();
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);
  const autoLoginTriggered = useRef(false);
  const lastUsed = authClient.getLastUsedLoginMethod();

  const invitationId = search.invitationId;
  const redirectPath = getSafeRedirectPath(search.redirect);
  const destination =
    redirectPath ??
    (invitationId ? `/invitation/accept/${invitationId}` : "/dashboard");
  const baseUrl = import.meta.env.VITE_CLIENT_URL;
  const providers = getProviders(config);
  const emailMethod = getEmailMethod(config);
  const getName = useProviderName(config?.customOAuthName);
  const { pending: providerPending, signIn: signInWithProvider } =
    useProviderSignIn({
      callbackURL: `${baseUrl}${destination}`,
      errorCallbackURL: `${baseUrl}/auth/sign-in`,
      captcha,
      getName,
    });
  const guest = useGuestSignIn(captcha, () => navigate({ to: destination }));
  const autoLogin =
    !captcha.siteKey &&
    Boolean(config?.customOAuthAutoLogin && config?.hasCustomOAuth) &&
    !search.error &&
    !autoLoginFailed;

  useEffect(() => {
    if (instanceStatus?.hasUsers === false) {
      navigate({ to: "/auth/sign-up", replace: true });
    }
  }, [instanceStatus, navigate]);

  useEffect(() => {
    if (isInstanceStatusError) {
      toast.error(
        instanceStatusError instanceof Error
          ? instanceStatusError.message
          : t("auth:signIn.instanceStatusError"),
      );
    }
  }, [isInstanceStatusError, instanceStatusError, t]);

  const signInWithSso = useCallback(async () => {
    const started = await signInWithProvider("custom");
    if (!started) setAutoLoginFailed(true);
  }, [signInWithProvider]);

  useEffect(() => {
    if (!autoLogin || autoLoginTriggered.current) return;
    autoLoginTriggered.current = true;
    void signInWithSso();
  }, [autoLogin, signInWithSso]);

  if (
    isConfigLoading ||
    isInstanceStatusLoading ||
    instanceStatus?.hasUsers === false
  ) {
    return (
      <>
        <PageTitle title={t("auth:signIn.pageTitle")} />
        <AuthPage title={t("auth:signIn.heading")}>
          <AuthFormSkeleton />
        </AuthPage>
      </>
    );
  }

  if (autoLogin) {
    return (
      <>
        <PageTitle title={t("auth:signIn.pageTitle")} />
        <AutoLoginRedirect
          providerName={getName("custom")}
          onContinue={() => void signInWithSso()}
        />
      </>
    );
  }

  const busy = providerPending !== null || guest.isPending;
  const errorMessage = search.error
    ? t(
        `auth:signIn.errors.${search.error.replace(/[._]+/g, "_").toLowerCase()}`,
        { defaultValue: search.error.replace(/_/g, " ") },
      )
    : null;

  return (
    <>
      <PageTitle title={t("auth:signIn.pageTitle")} />
      <AuthPage
        title={t("auth:signIn.heading")}
        description={t(getSignInSubtitleKey(emailMethod, providers))}
        notice={
          errorMessage || invitationId ? (
            <>
              {errorMessage ? (
                <Alert variant="error">
                  <CircleAlert />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
              {invitationId ? (
                <InvitationNotice
                  invitationId={invitationId}
                  description={t("auth:signIn.invitation.description")}
                />
              ) : null}
            </>
          ) : null
        }
      >
        {emailMethod === "code" ? (
          <EmailCodeForm
            defaultEmail={search.email}
            captcha={captcha}
            disabled={busy}
            onSent={({ email }) =>
              history.push(
                buildVerifyOtpPath({
                  email,
                  invitationId,
                  redirect: redirectPath,
                }),
              )
            }
          />
        ) : null}
        {emailMethod === "password" ? (
          <PasswordSignInForm
            defaultEmail={search.email}
            canResetPassword={config?.hasSmtp}
            captcha={captcha}
            disabled={busy}
            onSuccess={() => navigate({ to: destination })}
          />
        ) : null}
        {emailMethod && providers.length > 0 ? <AuthDivider /> : null}
        {!emailMethod && captcha.siteKey ? (
          <div className="pb-3">
            <AuthCaptcha captcha={captcha} />
          </div>
        ) : null}
        {providers.length > 0 ? (
          <ProviderButtons
            providers={providers}
            layout={emailMethod ? "compact" : "stacked"}
            getName={getName}
            lastUsed={lastUsed}
            pending={providerPending}
            disabled={captcha.pending || guest.isPending}
            onSelect={(provider) => void signInWithProvider(provider)}
          />
        ) : null}
        <div className="flex flex-col gap-2 pt-8 text-muted-foreground text-sm">
          <SignInFooterLine
            footer={getSignInFooter(config, emailMethod, providers)}
            invitationId={invitationId}
            email={search.email}
          />
          {config?.hasGuestAccess && !invitationId ? (
            <p>
              {t("auth:signIn.footer.justLooking")}{" "}
              <button
                type="button"
                className={authLinkClassName}
                disabled={captcha.pending || busy}
                onClick={guest.signIn}
              >
                {t("auth:signUp.continueAsGuest")}
              </button>
            </p>
          ) : null}
        </div>
      </AuthPage>
    </>
  );
}
