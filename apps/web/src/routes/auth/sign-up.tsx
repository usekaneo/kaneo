import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthToggle } from "@/components/auth/toggle";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const signUpSearchSchema = z.object({
  invitationId: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  validateSearch: signUpSearchSchema,
});

function SignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/sign-up" });
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const { data: config } = useGetConfig();

  const invitationId = search.invitationId;
  const prefillEmail = search.email;

  const handleGuestAccess = async () => {
    setIsGuestLoading(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success(t("auth:signIn.guestSuccess"));
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.guestError"),
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

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

          {config?.hasGuestAccess &&
            !invitationId &&
            !config?.disablePasswordRegistration && (
              <>
                <Button
                  variant="outline"
                  onClick={handleGuestAccess}
                  disabled={isGuestLoading}
                  className="w-full mb-0"
                  size="sm"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  {isGuestLoading
                    ? t("auth:signUp.signingIn")
                    : t("auth:signUp.continueAsGuest")}
                </Button>
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">
                    {t("auth:forms.or")}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}
          {!config?.disablePasswordRegistration && (
            <SignUpForm
              invitationId={invitationId}
              defaultEmail={prefillEmail}
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
