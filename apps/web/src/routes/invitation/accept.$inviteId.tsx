import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  LogIn,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGetInvitationDetails } from "@/hooks/queries/invitation/use-get-invitation-details";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/invitation/accept/$inviteId")({
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const { t } = useTranslation();
  const { inviteId } = useParams({
    from: "/invitation/accept/$inviteId",
  });
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);

  const { data: session, isPending: isSessionLoading } =
    authClient.useSession();
  const {
    data: invitationData,
    isLoading: isInvitationLoading,
    error: invitationError,
  } = useGetInvitationDetails(inviteId);

  const isLoading = isSessionLoading || isInvitationLoading;
  const isSignedIn = !!session?.user;

  const handleAcceptInvitation = async () => {
    setIsAccepting(true);
    try {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId: inviteId,
      });

      if (error) {
        toast.error(error.message || t("auth:invitation.toast.acceptFailed"));
        return;
      }

      await authClient.organization.setActive({
        organizationId: data?.invitation.organizationId,
      });

      toast.success(t("auth:invitation.toast.acceptSuccess"));

      if (!session?.user?.name) {
        navigate({ to: "/profile-setup" });
        return;
      }

      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: data?.invitation.organizationId || "" },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth:invitation.toast.acceptFailed"),
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    const email = invitationData?.invitation?.email;
    navigate({
      to: "/auth/sign-in",
      search: { invitationId: inviteId, email },
    });
  };

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleAccept")} />
        <AuthLayout title={t("auth:invitation.loadingTitle")}>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </AuthLayout>
      </>
    );
  }

  if (invitationError || !invitationData) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleError")} />
        <AuthLayout title={t("auth:invitation.errorTitle")}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("auth:invitation.errorLoadDescription")}
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/sign-in">{t("auth:invitation.goToSignIn")}</Link>
            </Button>
          </div>
        </AuthLayout>
      </>
    );
  }

  if (!invitationData.valid) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleInvalid")} />
        <AuthLayout title={t("auth:invitation.invalidTitle")}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              {invitationData.invitation?.expired ? (
                <Clock className="w-6 h-6 text-destructive" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive" />
              )}
            </div>

            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {invitationData.invitation?.expired
                  ? t("auth:invitation.invitationExpired")
                  : t("auth:invitation.invalidTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {invitationData.error}
              </p>
              {invitationData.invitation && (
                <p className="text-xs text-muted-foreground">
                  {t("auth:invitation.workspaceLabel", {
                    workspaceName: invitationData.invitation.workspaceName,
                  })}
                </p>
              )}
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/sign-in">{t("auth:invitation.goToSignIn")}</Link>
            </Button>
          </div>
        </AuthLayout>
      </>
    );
  }

  const invitation = invitationData.invitation ?? null;

  if (!invitation) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleInvalid")} />
        <AuthLayout title={t("auth:invitation.invalidTitle")}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
          </div>
        </AuthLayout>
      </>
    );
  }

  if (isSignedIn) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleAccept")} />
        <AuthLayout title={t("auth:invitation.pageTitleAccept")}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-primary/10 rounded-full">
              <Users className="w-6 h-6 text-primary" />
            </div>

            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {t("auth:invitation.joinWorkspace", {
                  workspaceName: invitation.workspaceName,
                })}
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans
                  i18nKey="auth:invitation.inviteBodySignedIn"
                  values={{ inviterName: invitation.inviterName }}
                  components={{ inviter: <strong /> }}
                />
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={handleAcceptInvitation}
                disabled={isAccepting}
                className="w-full"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("auth:invitation.accepting")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t("auth:invitation.acceptInvitation")}
                  </>
                )}
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link to="/dashboard">
                  {t("auth:invitation.goToDashboard")}
                </Link>
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                <Trans
                  i18nKey="auth:invitation.signedInAs"
                  values={{ email: session.user.email }}
                  components={{ email: <strong /> }}
                />
              </p>
            </div>
          </div>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:invitation.pageTitleAccept")} />
      <AuthLayout title={t("auth:invitation.youveBeenInvited")}>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-primary/10 rounded-full">
            <Users className="w-6 h-6 text-primary" />
          </div>

          <div className="space-y-3 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              {t("auth:invitation.joinWorkspace", {
                workspaceName: invitation.workspaceName,
              })}
            </h2>
            <p className="text-sm text-muted-foreground">
              <Trans
                i18nKey="auth:invitation.inviteBodySignedOut"
                values={{ inviterName: invitation.inviterName }}
                components={{ inviter: <strong /> }}
              />
            </p>
            <p className="text-sm text-muted-foreground">
              {t("auth:invitation.signInToAccept")}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button onClick={handleSignIn} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              {t("auth:invitation.signIn")}
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                <Trans
                  i18nKey="auth:invitation.invitationFor"
                  values={{ email: invitation.email }}
                  components={{ email: <strong /> }}
                />
              </p>
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
