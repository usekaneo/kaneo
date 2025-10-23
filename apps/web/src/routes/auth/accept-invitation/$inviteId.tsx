import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Mail, Users } from "lucide-react";
import { useEffect } from "react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "../../../components/auth/layout";

export const Route = createFileRoute("/auth/accept-invitation/$inviteId")({
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const { inviteId } = useParams({ from: "/auth/accept-invitation/$inviteId" });

  useEffect(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: we need to set the cookie to the invite id
    document.cookie = `pending_invitation=${inviteId}; path=/; max-age=3600`;
  }, [inviteId]);

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
              Join the team
            </h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                You've been invited to join an organization on Kaneo.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Please sign in or create an account to accept this invitation.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button asChild className="w-full">
              <Link to="/auth/sign-in">
                <Mail className="w-4 h-4 mr-2" />
                Sign in to accept invitation
              </Link>
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Invitation ID: <span className="font-mono">{inviteId}</span>
              </p>
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
