import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Github, KeyRound, UserCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";
import { OtpSignInForm } from "../../components/auth/otp-sign-in-form";
import { SignInForm } from "../../components/auth/sign-in-form";
import { SignInFormSkeleton } from "../../components/auth/sign-in-form-skeleton";
import { AuthToggle } from "../../components/auth/toggle";
import { Turnstile } from "../../components/auth/turnstile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

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
  const search = useSearch({ from: "/auth/sign-in" });
  const [isCustomOAuthLoading, setIsCustomOAuthLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);
  const lastLoginMethod = authClient.getLastUsedLoginMethod();
  const { data: config, isLoading: isConfigLoading } = useGetConfig();
  const {
    data: instanceStatus,
    isLoading: isInstanceStatusLoading,
    isError: isInstanceStatusError,
    error: instanceStatusError,
  } = useInstanceStatus();

  useEffect(() => {
    if (instanceStatus && instanceStatus.hasUsers === false) {
      navigate({ to: "/auth/sign-up", replace: true });
    }
  }, [instanceStatus, navigate]);

  useEffect(() => {
    if (isInstanceStatusError) {
      toast.error(
        instanceStatusError instanceof Error
          ? instanceStatusError.message
          : t("auth:signIn.instanceStatusError", {
              defaultValue:
                "Couldn't reach the server. Please retry in a moment.",
            }),
      );
    }
  }, [isInstanceStatusError, instanceStatusError, t]);
  const autoLoginTriggered = useRef(false);

  const invitationId = search.invitationId;
  const defaultEmail = search.email;
  const captchaConfigured = Boolean(TURNSTILE_SITE_KEY);
  const captchaPending = captchaConfigured && !turnstileToken;

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);
  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const getSafeRedirectPath = useCallback(() => {
    const redirectPath = search.redirect;
    if (redirectPath?.startsWith("/") && !redirectPath.includes("//")) {
      return redirectPath;
    }
    return undefined;
  }, [search.redirect]);

  const getCallbackUrl = useCallback(() => {
    const baseUrl = import.meta.env.VITE_CLIENT_URL;
    const redirectPath = getSafeRedirectPath();
    if (redirectPath) {
      return `${baseUrl}${redirectPath}`;
    }
    if (invitationId) {
      return `${baseUrl}/invitation/accept/${invitationId}`;
    }
    return `${baseUrl}/dashboard`;
  }, [invitationId, getSafeRedirectPath]);

  const handleCustomOAuth = useCallback(async () => {
    setIsCustomOAuthLoading(true);
    try {
      const result = await authClient.signIn.oauth2({
        providerId: "custom",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.oidcError"),
      );
      setAutoLoginFailed(true);
    } finally {
      setIsCustomOAuthLoading(false);
    }
  }, [getCallbackUrl, t]);

  const handleSignInGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.googleError"),
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignInGithub = async () => {
    setIsGithubLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.githubError"),
      );
    } finally {
      setIsGithubLoading(false);
    }
  };

  const handleSignInDiscord = async () => {
    setIsDiscordLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL: getCallbackUrl(),
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.discordError"),
      );
    } finally {
      setIsDiscordLoading(false);
    }
  };

  const handleSignInSuccess = () => {
    const redirectPath = getSafeRedirectPath();
    if (redirectPath) {
      navigate({ to: redirectPath });
    } else if (invitationId) {
      navigate({ to: `/invitation/accept/${invitationId}` });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  const handleGuestAccess = async () => {
    if (captchaPending) return;
    setIsGuestLoading(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success(t("auth:signIn.guestSuccess"));
      handleSignInSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.guestError"),
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

  useEffect(() => {
    if (search.error) {
      setAutoLoginFailed(true);
    }
  }, [search.error]);

  useEffect(() => {
    if (
      config?.customOAuthAutoLogin &&
      config?.hasCustomOAuth &&
      !autoLoginTriggered.current &&
      !search.error
    ) {
      autoLoginTriggered.current = true;
      handleCustomOAuth();
    }
  }, [config, handleCustomOAuth, search.error]);

  // Treat "no users yet" as still loading so the skeleton stays visible
  // while the useEffect above redirects to /auth/sign-up. Otherwise the
  // form briefly paints before the redirect fires.
  if (
    isConfigLoading ||
    isInstanceStatusLoading ||
    instanceStatus?.hasUsers === false ||
    (config?.customOAuthAutoLogin && config?.hasCustomOAuth && !autoLoginFailed)
  ) {
    return (
      <>
        <PageTitle title={t("auth:signIn.pageTitle")} />
        <AuthLayout
          title={t("auth:signIn.title")}
          subtitle={t("auth:signIn.subtitle")}
        >
          <SignInFormSkeleton />
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:signIn.pageTitle")} />
      <AuthLayout
        title={t("auth:signIn.title")}
        subtitle={
          invitationId
            ? t("auth:signIn.invitationSubtitle")
            : t("auth:signIn.subtitle")
        }
      >
        <div className="mt-6">
          {search.error && (
            <Alert variant="error" className="mb-4">
              <AlertDescription>
                {(() => {
                  const errorKey = search.error
                    .replace(/[._]+/g, "_")
                    .toLowerCase();
                  const translationKey = `auth:signIn.errors.${errorKey}`;
                  const translated = t(translationKey, { defaultValue: "" });
                  return translated || search.error.replace(/_/g, " ");
                })()}
              </AlertDescription>
            </Alert>
          )}

          {invitationId && (
            <Alert className="mb-4">
              <AlertDescription>
                {t("auth:signIn.invitationAlert")}
              </AlertDescription>
            </Alert>
          )}

          {(config?.hasGoogleSignIn ||
            config?.hasGithubSignIn ||
            config?.hasDiscordSignIn ||
            config?.hasCustomOAuth ||
            (config?.hasGuestAccess && !invitationId)) && (
            <>
              <div className="space-y-3">
                {config?.hasGoogleSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInGoogle}
                      disabled={isGoogleLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "google" && "border-primary/50!",
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                        aria-label={t("auth:providers.google")}
                      >
                        <title>Google</title>
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      {isGoogleLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithGoogle")}
                    </Button>
                    {lastLoginMethod === "google" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}

                {config?.hasGithubSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInGithub}
                      disabled={isGithubLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "github" && "border-primary/50!",
                      )}
                    >
                      <Github className="w-5 h-5 mr-2" />
                      {isGithubLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithGithub")}
                    </Button>
                    {lastLoginMethod === "github" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}

                {config?.hasDiscordSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInDiscord}
                      disabled={isDiscordLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "discord" && "border-primary/50!",
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        aria-label={t("auth:providers.discord")}
                      >
                        <title>Discord</title>
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      {isDiscordLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithDiscord")}
                    </Button>
                    {lastLoginMethod === "discord" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}

                {config?.hasCustomOAuth && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleCustomOAuth}
                      disabled={isCustomOAuthLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "custom" && "border-primary/50!",
                      )}
                    >
                      <KeyRound className="w-5 h-5 mr-2" />
                      {isCustomOAuthLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signIn.continueWithOidc")}
                    </Button>
                    {lastLoginMethod === "custom" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        {t("auth:signIn.lastUsed")}
                      </span>
                    )}
                  </div>
                )}

                {config?.hasGuestAccess && !invitationId && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleGuestAccess}
                      disabled={isGuestLoading || captchaPending}
                      className="w-full"
                    >
                      <UserCheck className="w-5 h-5 mr-2" />
                      {isGuestLoading
                        ? t("auth:signIn.signingIn")
                        : t("auth:signUp.continueAsGuest")}
                    </Button>
                    {captchaConfigured && TURNSTILE_SITE_KEY && (
                      <Turnstile
                        siteKey={TURNSTILE_SITE_KEY}
                        onVerify={handleTurnstileVerify}
                        onExpire={handleTurnstileExpire}
                        onError={handleTurnstileExpire}
                      />
                    )}
                  </>
                )}
              </div>

              {!config?.disableLoginForm && (
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">
                      {t("auth:forms.or")}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          {!config?.disableLoginForm &&
            (config?.hasSmtp ? (
              <OtpSignInForm
                invitationId={invitationId}
                defaultEmail={defaultEmail}
                redirect={getSafeRedirectPath()}
                onSuccess={handleSignInSuccess}
              />
            ) : (
              <SignInForm
                defaultEmail={defaultEmail}
                onSuccess={handleSignInSuccess}
              />
            ))}
          {config?.disableRegistration ||
          config?.disablePasswordRegistration ? (
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                {config?.disableRegistration
                  ? t("auth:signIn.registrationDisabled")
                  : t("auth:signIn.passwordRegistrationDisabled")}
              </p>
            </div>
          ) : !config?.disableLoginForm ? (
            <AuthToggle
              message={t("auth:signIn.toggleMessage")}
              linkText={t("auth:signIn.toggleLink")}
              linkTo="/auth/sign-up"
            />
          ) : null}
        </div>
      </AuthLayout>
    </>
  );
}
