import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <>
      <PageTitle title={t("auth:passwordReset.resetTitle")} />
      <AuthLayout
        title={t("auth:passwordReset.resetTitle")}
        subtitle={t("auth:passwordReset.resetSubtitle")}
      >
        <div className="space-y-4 mt-4">
          {success ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("auth:passwordReset.success")}
            </p>
          ) : invalidLink ? (
            <>
              <p role="alert" className="text-sm text-destructive">
                {t("auth:passwordReset.invalidLink")}
              </p>
              <Button
                render={<Link to="/auth/forgot-password" />}
                className="w-full"
              >
                {t("auth:passwordReset.requestNewLink")}
              </Button>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  {t("auth:passwordReset.newPassword")}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  {t("auth:passwordReset.confirmPassword")}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={isPending}
                  aria-describedby={error ? "reset-error" : undefined}
                />
              </div>
              {error && (
                <p
                  id="reset-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={isPending}
              >
                {isPending
                  ? t("auth:passwordReset.resetting")
                  : t("auth:passwordReset.resetPassword")}
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
