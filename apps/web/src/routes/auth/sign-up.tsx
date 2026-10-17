import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthCaptcha } from "@/components/auth/auth-captcha";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import {
  getProviders,
  getSignUpEmailMethod,
} from "@/components/auth/auth-methods";
import { AuthPage } from "@/components/auth/auth-page";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { InvitationNotice } from "@/components/auth/invitation-notice";
import { PasswordSignUpForm } from "@/components/auth/password-sign-up-form";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { useAuthCaptcha } from "@/components/auth/use-auth-captcha";
import { useGuestSignIn } from "@/components/auth/use-guest-sign-in";
import { useProviderName } from "@/components/auth/use-provider-name";
import { useProviderSignIn } from "@/components/auth/use-provider-sign-in";
import {
  buildVerifyOtpPath,
  type VerifyOtpState,
} from "@/components/auth/verify-otp-path";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getConfig } from "@/fetchers/config/get-config";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { toast } from "@/lib/toast";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  validateSearch: signUpSearchSchema,
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["config"],
      queryFn: getConfig,
    }),
});

function SignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { history } = useRouter();
  const search = useSearch({ from: "/auth/sign-up" });
  const captcha = useAuthCaptcha();
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const {
    data: instanceStatus,
    isError: isInstanceStatusError,
    error: instanceStatusError,
  } = useInstanceStatus();

  useEffect(() => {
    if (isInstanceStatusError) {
      toast.error(
        instanceStatusError instanceof Error
          ? instanceStatusError.message
          : t("auth:signUp.instanceStatusError"),
      );
    }
  }, [isInstanceStatusError, instanceStatusError, t]);

  const invitationId = search.invitationId;
  const isInstanceAdminSetup = instanceStatus?.hasUsers === false;
  const destination = invitationId
    ? `/invitation/accept/${invitationId}`
    : "/dashboard";
  const baseUrl = import.meta.env.VITE_CLIENT_URL ?? window.location.origin;
  const selfServiceAllowed =
    !config?.disableRegistration ||
    Boolean(invitationId) ||
    isInstanceAdminSetup;
  const emailMethod = getSignUpEmailMethod(config, isInstanceAdminSetup);
  const providers = selfServiceAllowed ? getProviders(config) : [];
  const getName = useProviderName(config?.customOAuthName);
  const providerSignIn = useProviderSignIn({
    callbackURL: `${baseUrl}${destination}`,
    errorCallbackURL: `${baseUrl}/auth/sign-up`,
    captcha,
    getName,
  });
  const guest = useGuestSignIn(captcha, () => navigate({ to: "/dashboard" }));
  const busy = providerSignIn.pending !== null || guest.isPending;
  const showGuest =
    config?.hasGuestAccess && !invitationId && !isInstanceAdminSetup;

  const description = isInstanceAdminSetup
    ? t("auth:signUp.instanceAdminSubtitle")
    : emailMethod === "code"
      ? t("auth:signUp.subtitle.email")
      : emailMethod === "password"
        ? t("auth:signUp.subtitle.password")
        : t("auth:signUp.subtitle.providers");

  const notice = invitationId ? (
    <InvitationNotice
      invitationId={invitationId}
      description={t("auth:signUp.invitation.description")}
    />
  ) : config?.disableRegistration && !isInstanceAdminSetup ? (
    <Alert role="note">
      <Info />
      <AlertDescription>
        {t("auth:signUp.registrationDisabledAlert")}
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <>
      <PageTitle title={t("auth:signUp.pageTitle")} />
      <AuthPage
        title={
          isInstanceAdminSetup
            ? t("auth:signUp.instanceAdminTitle")
            : t("auth:signUp.heading")
        }
        description={isConfigLoading ? undefined : description}
        notice={notice}
      >
        {isConfigLoading ? <AuthFormSkeleton /> : null}
        {emailMethod === "code" ? (
          <EmailCodeForm
            withName
            defaultEmail={search.email}
            captcha={captcha}
            disabled={busy}
            onSent={({ email, name }) =>
              history.push(buildVerifyOtpPath({ email, invitationId }), {
                signUpName: name,
              } satisfies VerifyOtpState)
            }
          />
        ) : null}
        {emailMethod === "password" ? (
          <PasswordSignUpForm
            defaultEmail={search.email}
            invitationId={invitationId}
            captcha={captcha}
            disabled={busy}
            onSuccess={() => navigate({ to: destination })}
          />
        ) : null}
        {emailMethod && providers.length > 0 ? <AuthDivider /> : null}
        {!emailMethod && providers.length > 0 && captcha.siteKey ? (
          <div className="pb-3">
            <AuthCaptcha captcha={captcha} />
          </div>
        ) : null}
        {providers.length > 0 ? (
          <ProviderButtons
            providers={providers}
            layout={emailMethod ? "compact" : "stacked"}
            getName={getName}
            lastUsed={null}
            pending={providerSignIn.pending}
            disabled={captcha.pending || guest.isPending}
            onSelect={(provider) => void providerSignIn.signIn(provider)}
          />
        ) : null}
        {!isConfigLoading && !emailMethod && providers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("auth:signIn.footer.inviteOnly")}
          </p>
        ) : null}
        {isInstanceAdminSetup ? null : (
          <div className="flex flex-col gap-2 pt-8 text-muted-foreground text-sm">
            <p>
              {t("auth:signUp.toggleMessage")}{" "}
              <Link
                to="/auth/sign-in"
                search={{ invitationId, email: search.email }}
                className={authLinkClassName}
              >
                {t("auth:signUp.toggleLink")}
              </Link>
            </p>
            {showGuest ? (
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
        )}
      </AuthPage>
    </>
  );
}
