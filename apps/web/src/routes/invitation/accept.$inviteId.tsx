import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { TriangleAlert, UserCheckIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthDetails } from "@/components/auth/auth-details";
import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { AuthPage } from "@/components/auth/auth-page";
import { useSettledSession } from "@/components/auth/use-settled-session";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGetInvitationDetails } from "@/hooks/queries/invitation/use-get-invitation-details";
import { authClient } from "@/lib/auth-client";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/invitation/accept/$inviteId")({
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const { t } = useTranslation();
  const { inviteId } = useParams({ from: "/invitation/accept/$inviteId" });
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const { session, isLoading: isSessionLoading } = useSettledSession();
  const {
    data: invitationData,
    isLoading: isInvitationLoading,
    error: invitationError,
  } = useGetInvitationDetails(inviteId);
  const invitation = invitationData?.invitation;

  const goToAuth = (to: "/auth/sign-in" | "/auth/sign-up") =>
    navigate({
      to,
      search: { invitationId: inviteId, email: invitation?.email },
    });

  const goToKaneo = (
    <p className="pt-8 text-muted-foreground text-sm">
      <Link to="/dashboard" className={authLinkClassName}>
        {t("auth:invitation.goToKaneo")}
      </Link>
    </p>
  );

  if (isSessionLoading || isInvitationLoading) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleAccept")} />
        <AuthPage title={t("auth:invitation.pageTitleAccept")}>
          <AuthFormSkeleton />
        </AuthPage>
      </>
    );
  }

  if (invitationError || !invitationData) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleError")} />
        <AuthPage
          title={t("auth:invitation.loadFailed.title")}
          description={t("auth:invitation.loadFailed.description")}
        >
          {goToKaneo}
        </AuthPage>
      </>
    );
  }

  if (!invitationData.valid || !invitation) {
    const expired = invitation?.expired;
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleInvalid")} />
        <AuthPage
          title={
            expired
              ? t("auth:invitation.expired.title")
              : t("auth:invitation.invalid.title")
          }
          description={
            expired
              ? t("auth:invitation.expired.description", {
                  inviterName: invitation.inviterName,
                  workspaceName: invitation.workspaceName,
                })
              : t("auth:invitation.invalid.description")
          }
        >
          {goToKaneo}
        </AuthPage>
      </>
    );
  }

  const title = t("auth:invitation.joinWorkspace", {
    workspaceName: invitation.workspaceName,
  });
  const description = t("auth:invitation.description", {
    inviterName: invitation.inviterName,
  });
  const invitedBy = {
    label: t("auth:invitation.invitedBy"),
    value: invitation.inviterName,
  };
  const expires = {
    label: t("auth:invitation.expires"),
    value: formatDateMedium(invitation.expiresAt),
  };

  if (!session?.user) {
    return (
      <>
        <PageTitle title={t("auth:invitation.pageTitleAccept")} />
        <AuthPage title={title} description={description}>
          <div className="flex flex-col gap-4">
            <AuthDetails
              rows={[
                invitedBy,
                {
                  label: t("auth:invitation.sentTo"),
                  value: invitation.email,
                },
                expires,
              ]}
            />
            <Button
              size="lg"
              className="w-full"
              onClick={() => goToAuth("/auth/sign-up")}
            >
              {t("auth:invitation.createAccount")}
            </Button>
          </div>
          <p className="pt-8 text-muted-foreground text-sm">
            {t("auth:signUp.toggleMessage")}{" "}
            <button
              type="button"
              className={authLinkClassName}
              onClick={() => goToAuth("/auth/sign-in")}
            >
              {t("auth:invitation.signIn")}
            </button>
          </p>
        </AuthPage>
      </>
    );
  }

  const isRecipient =
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  const accept = async () => {
    setIsAccepting(true);
    try {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId: inviteId,
      });
      if (error) {
        toast.error(error.message || t("auth:invitation.toast.acceptFailed"));
        setIsAccepting(false);
        return;
      }
      const workspaceId = data?.invitation.organizationId ?? "";
      await authClient.organization.setActive({ organizationId: workspaceId });
      toast.success(t("auth:invitation.toast.acceptSuccess"), {
        icon: UserCheckIcon,
      });
      if (!session.user.name) {
        navigate({ to: "/profile-setup" });
        return;
      }
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("auth:invitation.toast.acceptFailed"),
      );
      setIsAccepting(false);
    }
  };

  const switchAccount = async () => {
    setIsSwitching(true);
    try {
      await authClient.signOut();
      goToAuth("/auth/sign-in");
    } catch {
      setIsSwitching(false);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:invitation.pageTitleAccept")} />
      <AuthPage title={title} description={description}>
        <div className="flex flex-col gap-4">
          {isRecipient ? (
            <AuthDetails
              rows={[
                invitedBy,
                {
                  label: t("auth:invitation.signedInAs"),
                  value: session.user.email,
                },
                expires,
              ]}
            />
          ) : (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>{t("auth:invitation.mismatch.title")}</AlertTitle>
              <AlertDescription>
                {t("auth:invitation.mismatch.description", {
                  invitedEmail: invitation.email,
                  email: session.user.email,
                })}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={isAccepting || isSwitching}
              render={<Link to="/dashboard" />}
            >
              {t("auth:invitation.notNow")}
            </Button>
            {isRecipient ? (
              <Button size="lg" loading={isAccepting} onClick={accept}>
                {t("auth:invitation.join")}
              </Button>
            ) : (
              <Button size="lg" loading={isSwitching} onClick={switchAccount}>
                {t("auth:invitation.switchAccount")}
              </Button>
            )}
          </div>
        </div>
      </AuthPage>
    </>
  );
}
