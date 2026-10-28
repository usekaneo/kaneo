import { createFileRoute, Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthCaptcha } from "@/components/auth/auth-captcha";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { AuthPage } from "@/components/auth/auth-page";
import { useAuthCaptcha } from "@/components/auth/use-auth-captcha";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const { t } = useTranslation();
  const { data: config, isLoading, isError } = useGetConfig();
  const captcha = useAuthCaptcha();
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const available = config?.hasSmtp && !config.disableLoginForm;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || !available || captcha.pending) return;
    setIsPending(true);
    setError(false);
    try {
      const result = await authClient.requestPasswordReset(
        {
          email,
          redirectTo: new URL("/auth/reset-password", window.location.origin)
            .href,
        },
        { headers: captcha.headers },
      );
      if (result.error) setError(true);
      else setSentTo(email);
    } catch {
      setError(true);
    } finally {
      setIsPending(false);
      captcha.reset();
    }
  };

  const footer = (
    <p className="pt-8 text-muted-foreground text-sm">
      {t("auth:passwordReset.rememberedIt")}{" "}
      <Link to="/auth/sign-in" className={authLinkClassName}>
        {t("auth:passwordReset.backToSignIn")}
      </Link>
    </p>
  );

  if (sentTo) {
    return (
      <>
        <PageTitle title={t("auth:passwordReset.requestTitle")} />
        <AuthPage
          title={t("auth:passwordReset.sentTitle")}
          description={
            <span role="status">
              {t("auth:passwordReset.sentDescription", { email: sentTo })}
            </span>
          }
        >
          <Alert variant="info" role="note">
            <Info />
            <AlertTitle>{t("auth:passwordReset.sentHelpTitle")}</AlertTitle>
            <AlertDescription>
              {t("auth:passwordReset.sentHelpDescription")}
            </AlertDescription>
          </Alert>
          {footer}
        </AuthPage>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:passwordReset.requestTitle")} />
      <AuthPage
        title={t("auth:passwordReset.requestTitle")}
        description={t("auth:passwordReset.requestSubtitle")}
      >
        {isError ? (
          <p role="alert" className="text-destructive-foreground text-sm">
            {t("auth:passwordReset.configError")}
          </p>
        ) : !isLoading && !available ? (
          <p role="status" className="text-muted-foreground text-sm">
            {t("auth:passwordReset.unavailable")}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-email">{t("auth:forms.email")}</Label>
              <Input
                id="reset-email"
                size="lg"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending || isLoading}
                placeholder={t("auth:forms.emailPlaceholder")}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "reset-email-error" : undefined}
              />
              {error ? (
                <p
                  id="reset-email-error"
                  role="alert"
                  className={authMessageClassName}
                >
                  {t("auth:passwordReset.requestError")}
                </p>
              ) : null}
            </div>
            <AuthCaptcha captcha={captcha} />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isPending}
              disabled={isLoading || !available || captcha.pending}
            >
              {t("auth:passwordReset.sendLink")}
            </Button>
          </form>
        )}
        {footer}
      </AuthPage>
    </>
  );
}
