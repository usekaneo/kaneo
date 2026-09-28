import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/auth/layout";
import { Turnstile } from "@/components/auth/turnstile";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { authClient } from "@/lib/auth-client";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const { t } = useTranslation();
  const { data: config, isLoading, isError } = useGetConfig();
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const available = config?.hasSmtp && !config.disableLoginForm;
  const captchaPending = Boolean(TURNSTILE_SITE_KEY) && !turnstileToken;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || !available || captchaPending) return;
    setIsPending(true);
    setError(false);
    try {
      const result = await authClient.requestPasswordReset(
        {
          email,
          redirectTo: new URL("/auth/reset-password", window.location.origin)
            .href,
        },
        {
          headers: turnstileToken
            ? { "x-turnstile-token": turnstileToken }
            : undefined,
        },
      );
      if (result.error) setError(true);
      else setSent(true);
    } catch {
      setError(true);
    } finally {
      setIsPending(false);
      setTurnstileToken(null);
      setCaptchaKey((key) => key + 1);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:passwordReset.requestTitle")} />
      <AuthLayout
        title={t("auth:passwordReset.requestTitle")}
        subtitle={t("auth:passwordReset.requestSubtitle")}
      >
        <div className="space-y-4 mt-4">
          {sent ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("auth:passwordReset.sent")}
            </p>
          ) : isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t("auth:passwordReset.configError")}
            </p>
          ) : !isLoading && !available ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("auth:passwordReset.unavailable")}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t("auth:forms.email")}</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isPending || isLoading}
                  placeholder={t("auth:forms.emailPlaceholder")}
                />
              </div>
              {TURNSTILE_SITE_KEY && (
                <Turnstile
                  key={captchaKey}
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                />
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {t("auth:passwordReset.requestError")}
                </p>
              )}
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={
                  isPending || isLoading || !available || captchaPending
                }
              >
                {isPending
                  ? t("auth:passwordReset.sending")
                  : t("auth:passwordReset.sendLink")}
              </Button>
            </form>
          )}
          <Button
            variant="ghost"
            render={<Link to="/auth/sign-in" />}
            className="w-full text-muted-foreground"
          >
            {t("auth:passwordReset.backToSignIn")}
          </Button>
        </div>
      </AuthLayout>
    </>
  );
}
