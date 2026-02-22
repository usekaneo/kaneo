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
        toast.error(error.message || "Failed to accept invitation");
        return;
      }

      await authClient.organization.setActive({
        organizationId: data?.invitation.organizationId,
      });

      toast.success("Invitation accepted! Welcome to the team.");

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
        error instanceof Error ? error.message : "Failed to accept invitation",
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
        <PageTitle title="Accept Invitation" />
        <AuthLayout title="Loading invitation...">
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
        <PageTitle title="Invitation Error" />
        <AuthLayout title="Invitation Error">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load invitation details. The invitation may be invalid
                or expired.
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/sign-in">Go to Sign In</Link>
            </Button>
          </div>
        </AuthLayout>
      </>
    );
  }

  if (!invitationData.valid) {
    return (
      <>
        <PageTitle title="Invalid Invitation" />
        <AuthLayout title="Invalid Invitation">
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
                  ? "Invitation Expired"
                  : "Invalid Invitation"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {invitationData.error}
              </p>
              {invitationData.invitation && (
                <p className="text-xs text-muted-foreground">
                  Workspace: {invitationData.invitation.workspaceName}
                </p>
              )}
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/sign-in">Go to Sign In</Link>
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
        <PageTitle title="Invalid Invitation" />
        <AuthLayout title="Invalid Invitation">
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
        <PageTitle title="Accept Invitation" />
        <AuthLayout title="Accept Invitation">
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-primary/10 rounded-full">
              <Users className="w-6 h-6 text-primary" />
            </div>

            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                Join {invitation.workspaceName}
              </h2>
              <p className="text-sm text-muted-foreground">
                <strong>{invitation.inviterName}</strong> has invited you to
                join their workspace.
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
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                Signed in as <strong>{session.user.email}</strong>
              </p>
            </div>
          </div>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Accept Invitation" />
      <AuthLayout title="You've been invited!">
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-primary/10 rounded-full">
            <Users className="w-6 h-6 text-primary" />
          </div>

          <div className="space-y-3 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Join {invitation.workspaceName}
            </h2>
            <p className="text-sm text-muted-foreground">
              <strong>{invitation.inviterName}</strong> has invited you to join
              their workspace on Kaneo.
            </p>
            <p className="text-sm text-muted-foreground">
              Sign in to accept this invitation.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button onClick={handleSignIn} className="w-full">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                Invitation for: <strong>{invitation.email}</strong>
              </p>
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
