import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { authMessageClassName } from "@/components/auth/auth-form-styles";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { AuthPage } from "@/components/auth/auth-page";
import { PasswordInput } from "@/components/auth/password-input";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPassword,
  validateSearch: z.object({
    token: z.string().optional(),
    error: z.string().optional(),
  }),
});

function ResetPassword() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/reset-password" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidLink = !search.token || Boolean(search.error) || invalidToken;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || invalidLink) return;
    if (password.length < 8 || password.length > 128) {
      setError(t("auth:passwordReset.passwordLength"));
      return;
    }
    if (password !== confirmation) {
      setError(t("auth:passwordReset.passwordMismatch"));
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: search.token,
      });
      if (result.error) {
        if (result.error.code === "INVALID_TOKEN") setInvalidToken(true);
        else setError(t("auth:passwordReset.resetError"));
      } else {
        setPassword("");
        setConfirmation("");
        setSuccess(true);
      }
    } catch {
      setError(t("auth:passwordReset.resetError"));
    } finally {
      setIsPending(false);
    }
  };

  if (success) {
    return (
      <>
        <PageTitle title={t("auth:passwordReset.resetTitle")} />
        <AuthPage
          title={t("auth:passwordReset.successTitle")}
          description={
            <span role="status">{t("auth:passwordReset.success")}</span>
          }
        >
          <Button
            size="lg"
            className="w-full"
            render={<Link to="/auth/sign-in" />}
          >
            {t("auth:passwordReset.backToSignIn")}
          </Button>
        </AuthPage>
      </>
    );
  }

  if (invalidLink) {
    return (
      <>
        <PageTitle title={t("auth:passwordReset.resetTitle")} />
        <AuthPage
          title={t("auth:passwordReset.invalidLinkTitle")}
          description={
            <span role="alert">{t("auth:passwordReset.invalidLink")}</span>
          }
        >
          <Button
            size="lg"
            className="w-full"
            render={<Link to="/auth/forgot-password" />}
          >
            {t("auth:passwordReset.requestNewLink")}
          </Button>
          <p className="pt-8 text-muted-foreground text-sm">
            <Link to="/auth/sign-in" className={authLinkClassName}>
              {t("auth:passwordReset.backToSignIn")}
            </Link>
          </p>
        </AuthPage>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:passwordReset.resetTitle")} />
      <AuthPage
        title={t("auth:passwordReset.resetTitle")}
        description={t("auth:passwordReset.resetDescription")}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">
              {t("auth:passwordReset.newPassword")}
            </Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">
              {t("auth:passwordReset.confirmPassword")}
            </Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={isPending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "reset-error" : undefined}
            />
            {error ? (
              <p id="reset-error" role="alert" className={authMessageClassName}>
                {error}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isPending}
          >
            {t("auth:passwordReset.updatePassword")}
          </Button>
        </form>
        <p className="pt-8 text-muted-foreground text-sm">
          {t("auth:passwordReset.changedMind")}{" "}
          <Link to="/auth/sign-in" className={authLinkClassName}>
            {t("auth:passwordReset.backToSignIn")}
          </Link>
        </p>
      </AuthPage>
    </>
  );
}
