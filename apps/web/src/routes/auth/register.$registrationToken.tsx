import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthToggle } from "@/components/auth/toggle";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import useGetConfig from "@/hooks/queries/config/use-get-config";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/register/$registrationToken")({
  component: Register,
  validateSearch: signUpSearchSchema,
});

function Register() {
  const { t } = useTranslation();
  const { registrationToken } = useParams({
    from: "/auth/register/$registrationToken",
  });
  const search = useSearch({ from: "/auth/register/$registrationToken" });
  const { data: config } = useGetConfig();

  const invitationId = search.invitationId;
  const prefillEmail = search.email;

  return (
    <>
      <PageTitle title={t("auth:signUp.pageTitle")} />
      <AuthLayout
        title={t("auth:signUp.title")}
        subtitle={
          invitationId
            ? t("auth:signUp.subtitleInvitation")
            : config?.disableRegistration
              ? t("auth:signUp.subtitleRegistrationDisabled")
              : config?.disablePasswordRegistration
                ? t("auth:signUp.subtitlePasswordDisabled")
                : t("auth:signUp.subtitleDefault")
        }
      >
        <div className="space-y-4 mt-6">
          {invitationId && (
            <Alert>
              <AlertDescription>
                {t("auth:signUp.invitationAlert")}
              </AlertDescription>
            </Alert>
          )}
          {config?.disableRegistration && !invitationId && (
            <Alert>
              <AlertDescription>
                {t("auth:signUp.registrationDisabledAlert")}
              </AlertDescription>
            </Alert>
          )}
          {config?.disablePasswordRegistration && (
            <Alert>
              <AlertDescription>
                {t("auth:signUp.passwordDisabledAlert")}
              </AlertDescription>
            </Alert>
          )}

          {!config?.disablePasswordRegistration && (
            <SignUpForm
              invitationId={invitationId}
              defaultEmail={prefillEmail}
              registrationToken={registrationToken}
            />
          )}
          <AuthToggle
            message={t("auth:signUp.toggleMessage")}
            linkText={t("auth:signUp.toggleLink")}
            linkTo="/auth/sign-in"
          />
        </div>
      </AuthLayout>
    </>
  );
}
